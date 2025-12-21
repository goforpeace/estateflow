'use client';

import React from 'react';
import type { Customer, InflowTransaction, Project } from '@/lib/types';

interface ReceiptProps {
    payment: InflowTransaction & { customerName: string; projectName: string; flatNumber: string };
    customer: Customer;
    project: Project;
}

const numberToWords = (num: number): string => {
    const a = [
        '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
    ];
    const b = [
        '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
    ];
    
    if (num === 0) return 'Zero';

    let str = '';

    const toWords = (n: number, s: string) => {
        if (n === 0) return '';
        let tempStr = '';
        if (n > 19) {
            tempStr = b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        } else {
            tempStr = a[n];
        }
        if (n !== 0) {
            tempStr += ' ' + s;
        }
        return tempStr;
    };
    
    let crore = Math.floor(num / 10000000);
    num %= 10000000;
    str += toWords(crore, 'Crore');

    let lakh = Math.floor(num / 100000);
    num %= 100000;
    str += ' ' + toWords(lakh, 'Lakh');

    let thousand = Math.floor(num / 1000);
    num %= 1000;
    str += ' ' + toWords(thousand, 'Thousand');
    
    let hundred = Math.floor(num / 100);
    num %= 100;
    str += ' ' + toWords(hundred, 'Hundred');

    if (num > 0) {
        str += (str !== '' ? ' and' : '') + ' ' + toWords(num, '');
    }

    return str.trim().replace(/\s+/g, ' ');
};


export const Receipt: React.FC<ReceiptProps> = ({ payment, customer, project }) => {
    const company = {
        name: 'Landmark New Homes Ltd.',
        logo: 'https://res.cloudinary.com/dj4lirc0d/image/upload/Artboard_1_pabijh.png',
        phone: '+8809649-699499',
        website: 'www.landmarkltd.net',
        email: 'info@landmarkltd.net',
        facebook: 'www.facebook.com/landmarkltd.net',
        address: 'House:4/C, Road: 7/B, Sector:09 Uttara Dhaka-1230'
    };

    const amountInWords = numberToWords(payment.amount) + ' Taka Only';

    return (
        <div id="receipt-printable-area" className="bg-white text-gray-800 font-sans p-4 print:p-0">
             <style jsx global>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #receipt-printable-area, #receipt-printable-area * {
                    visibility: visible;
                  }
                  #receipt-printable-area {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                  }
                  @page {
                    size: A4;
                    margin: 20mm;
                  }
                }
            `}</style>
            
            <div className="max-w-4xl mx-auto p-8 min-h-screen flex flex-col">
                {/* Header */}
                <header className="flex justify-between items-start pb-6 mb-8 border-b-2 border-primary">
                    <div className="w-32">
                        <img src={company.logo} alt={`${company.name} Logo`} style={{ width: '96px', height: 'auto' }} />
                    </div>
                    <div className="text-right">
                        <h1 className="text-3xl font-bold text-primary">{company.name}</h1>
                        <p className="text-sm text-gray-500">{company.address}</p>
                    </div>
                </header>

                <div className="flex-grow">
                    {/* Title & Info */}
                     <section className="flex items-start mb-10 w-full">
                        <div className="w-1/2">
                            <h2 className="text-2xl font-semibold text-gray-700 uppercase tracking-widest bg-gray-100 px-4 py-1 inline-block">
                                Money Receipt
                            </h2>
                        </div>
                        <div className="w-1/2 text-right text-sm">
                            <div className="flex justify-end items-center">
                                <span className="font-semibold text-gray-600 w-28 text-left">Receipt No:</span>
                                <span className="font-mono text-primary font-bold">{payment.receiptId}</span>
                            </div>
                            <div className="flex justify-end items-center mt-1">
                                <span className="font-semibold text-gray-600 w-28 text-left">Date:</span>
                                <span>{new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                        </div>
                    </section>
                    
                    {/* Body */}
                    <main className="space-y-5 text-base leading-relaxed mb-10">
                        <div className="flex items-baseline">
                            <p className="w-48 font-semibold shrink-0">Received with thanks from</p>
                            <p className="border-b border-dotted border-gray-400 flex-grow font-semibold text-primary pb-1">{customer.fullName}</p>
                        </div>
                        <div className="flex items-baseline">
                            <p className="w-48 font-semibold shrink-0">Address</p>
                            <p className="border-b border-dotted border-gray-400 flex-grow pb-1">{customer.address}</p>
                        </div>
                        <div className="flex items-baseline">
                            <p className="w-48 font-semibold shrink-0">The sum of Taka</p>
                            <p className="border-b border-dotted border-gray-400 flex-grow capitalize font-medium pb-1">{amountInWords}</p>
                        </div>
                        <div className="flex items-baseline">
                            <p className="w-48 font-semibold shrink-0">By</p>
                            <p className="border-b border-dotted border-gray-400 flex-grow pb-1">{payment.paymentMethod}{payment.reference ? ` (Ref: ${payment.reference})`: ''}</p>
                        </div>
                        <div className="flex items-baseline">
                            <p className="w-48 font-semibold shrink-0">On account of</p>
                            <p className="border-b border-dotted border-gray-400 flex-grow pb-1">
                                <span className="font-medium">{payment.paymentPurpose === 'Other' ? payment.otherPurpose : payment.paymentPurpose}</span>
                                {' for Flat No. '}<span className="font-semibold">{payment.flatNumber}</span>
                                {' of project '}<span className="font-semibold">{payment.projectName}</span>, {project.location}.
                            </p>
                        </div>
                    </main>
                    
                    {/* Amount Box */}
                    <section className="my-12 flex justify-start">
                        <div className="border border-primary text-primary px-6 py-3 rounded-lg shadow-sm flex justify-center items-center">
                            <span className="text-lg font-bold">TK. {payment.amount.toLocaleString('en-IN')}/=</span>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <footer className="pt-8 mt-8 text-sm text-center">
                    <div className="flex justify-between items-end">
                        <div className="w-1/3">
                            <p className="border-t-2 border-gray-400 pt-2 font-bold">Received By</p>
                        </div>
                        <div className="w-1/3">
                            <p className="text-xs text-gray-400">This is a computer-generated receipt.</p>
                        </div>
                        <div className="w-1/3">
                            <p className="border-t-2 border-gray-400 pt-2 font-bold">For {company.name}</p>
                            <p>Authorized Signature</p>
                        </div>
                    </div>
                    <div className="mt-12 border-t pt-4 text-xs text-gray-500">
                        <p>Phone: {company.phone} | Email: {company.email} | Web: {company.website} | Facebook: {company.facebook}</p>
                        <p>{company.address}</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}
