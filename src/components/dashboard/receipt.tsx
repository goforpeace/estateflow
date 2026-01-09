'use client';

import React from 'react';
import type { Customer, InflowTransaction, Project } from '@/lib/types';

interface ReceiptProps {
    payment: InflowTransaction & { customerName: string; projectName: string; flatNumber: string };
    customer: Customer;
    project: Project;
}

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

    const amountInWords = (num: number): string => {
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

    const amountInWordsText = amountInWords(payment.amount) + ' Taka Only';

    return (
        <div id="receipt-printable-area" className="bg-white text-gray-800 font-sans">
            <div className="p-8 w-[210mm] min-h-[297mm] mx-auto flex flex-col">
                <header className="mb-10">
                    <div className="flex justify-center items-center mb-6">
                        <img src={company.logo} alt={`${company.name} Logo`} className="h-24" />
                    </div>
                    <div className="flex justify-between items-start">
                        {/* Left side: Receipt Title and Customer Info */}
                        <div className="w-1/2">
                            <h2 className="text-3xl font-semibold text-primary uppercase tracking-widest">Receipt</h2>
                        </div>

                        {/* Right side: Company Info and Payment Details */}
                        <div className="w-1/2 text-right">
                            <div className="text-sm mb-4">
                                <p className="font-bold text-lg">{company.name}</p>
                                <p>{company.address}</p>
                                <p>Email: {company.email}</p>
                                <p>Tel: {company.phone}</p>
                            </div>
                        </div>
                    </div>
                     <div className="flex justify-end mt-4">
                        <table className="w-48 text-sm">
                                <tbody>
                                    <tr>
                                        <td className="font-semibold pr-4">Date</td>
                                        <td>: {new Date(payment.date).toLocaleDateString('en-GB')}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pr-4">Receipt No</td>
                                        <td>: {payment.receiptId}</td>
                                    </tr>
                                </tbody>
                            </table>
                    </div>
                </header>

                <main className="flex-grow">
                    <div className="space-y-5">
                        <div className="flex items-baseline">
                            <span className="w-48 shrink-0 font-medium">Received with thanks from</span>
                            <p className="w-full border-b border-dotted border-gray-400 pb-1">{customer.fullName}</p>
                        </div>
                        <div className="flex items-baseline">
                            <span className="w-48 shrink-0 font-medium">The sum of Taka</span>
                            <p className="w-full border-b border-dotted border-gray-400 pb-1 capitalize">{amountInWordsText}</p>
                        </div>
                         <div className="flex items-baseline">
                            <span className="w-48 shrink-0 font-medium">By</span>
                            <p className="w-full border-b border-dotted border-gray-400 pb-1">{payment.paymentMethod} {payment.reference && `(${payment.reference})`}</p>
                        </div>
                        <div className="flex items-baseline">
                            <span className="w-48 shrink-0 font-medium">On account of</span>
                            <p className="w-full border-b border-dotted border-gray-400 pb-1">{payment.paymentPurpose === 'Other' ? payment.otherPurpose : payment.paymentPurpose}</p>
                        </div>
                         <div className="flex items-baseline">
                            <span className="w-28 shrink-0 font-medium">Project</span>
                             <p className="w-full border-b border-dotted border-gray-400 pb-1">{payment.projectName}</p>
                             <span className="w-28 shrink-0 font-medium text-center">Flat No.</span>
                             <p className="w-full border-b border-dotted border-gray-400 pb-1">{payment.flatNumber}</p>
                        </div>
                         <div className="flex items-baseline">
                             <p className="w-full font-bold text-lg text-center bg-gray-100 p-2 rounded-lg shadow-sm">৳{payment.amount.toLocaleString('en-IN')}/-</p>
                        </div>
                    </div>
                </main>

                <footer className="mt-auto pt-8">
                     <div className="flex justify-between items-end">
                        <div className="w-1/3 text-center">
                            <p className="border-t border-black pt-2 font-medium">Received By</p>
                        </div>
                         <div className="w-1/3 text-center text-xs text-gray-500">
                             <p>This is a computer-generated receipt and does not require a physical signature.</p>
                        </div>
                        <div className="w-1/3 text-center">
                            <p className="border-t border-black pt-2 font-medium">For, {company.name}</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
