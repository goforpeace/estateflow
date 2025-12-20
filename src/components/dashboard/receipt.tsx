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
    const g = [
        '', 'thousand', 'lakh', 'crore'
    ];

    const inWords = (n: number): string => {
        if (n < 20) return a[n];
        let digit = n % 10;
        return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
    };
    
    let n = Math.floor(num);
    if (n === 0) return 'Zero';

    let str = '';
    str += (n % 100) > 0 ? inWords(n % 100) : '';
    n = Math.floor(n / 100);
    str = (n % 10 > 0 ? inWords(n % 10) + ' hundred' : '') + (str ? ' ' + str : '');
    n = Math.floor(n / 10);

    let i = 0;
    while(n > 0) {
        let remainder = n % 100;
        if (remainder > 0) {
            str = inWords(remainder) + ' ' + g[i] + (str ? ' ' + str : '');
        }
        n = Math.floor(n / 100);
        i++;
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
        <div id="receipt-printable-area" className="p-8 bg-white font-sans a4-page mx-auto shadow-lg text-black">
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
                }
                .a4-page {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto;
                }
            `}</style>
            
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-gray-400">
                <div className="w-48 h-auto">
                    <img src={company.logo} alt="Company Logo" className="w-full h-auto" />
                </div>
                <div className="text-right">
                    <h1 className="text-3xl font-bold text-gray-800">{company.name}</h1>
                    <p className="text-sm text-gray-600">{company.address}</p>
                    <p className="text-sm text-gray-600">Phone: {company.phone} | Email: {company.email}</p>
                    <p className="text-sm text-gray-600">{company.website} | {company.facebook}</p>
                </div>
            </div>

            {/* Title */}
            <div className="text-center my-8">
                <h2 className="text-2xl font-semibold uppercase tracking-widest border-2 border-gray-800 inline-block px-4 py-2">
                    Money Receipt
                </h2>
            </div>
            
            {/* Receipt Info */}
            <div className="flex justify-between text-sm mb-8">
                <div>
                    <span className="font-bold">Receipt No: </span>
                    <span>{payment.receiptId}</span>
                </div>
                <div>
                    <span className="font-bold">Date: </span>
                    <span>{new Date(payment.date).toLocaleDateString('en-GB')}</span>
                </div>
            </div>

            {/* Body */}
            <div className="space-y-4 text-base">
                <div className="flex items-baseline">
                    <p className="w-48 font-semibold shrink-0">Received with thanks from</p>
                    <p className="border-b border-dotted border-gray-400 flex-grow font-semibold">{customer.fullName}</p>
                </div>
                <div className="flex items-baseline">
                    <p className="w-48 font-semibold shrink-0">Address</p>
                    <p className="border-b border-dotted border-gray-400 flex-grow">{customer.address}</p>
                </div>
                <div className="flex items-baseline">
                    <p className="w-48 font-semibold shrink-0">The sum of Taka</p>
                    <p className="border-b border-dotted border-gray-400 flex-grow capitalize">{amountInWords}</p>
                </div>
                 <div className="flex items-baseline">
                    <p className="w-48 font-semibold shrink-0">By</p>
                    <p className="border-b border-dotted border-gray-400 flex-grow">{payment.paymentMethod}{payment.reference ? ` (Ref: ${payment.reference})`: ''}</p>
                </div>
                 <div className="flex items-baseline">
                    <p className="w-48 font-semibold shrink-0">On account of</p>
                    <p className="border-b border-dotted border-gray-400 flex-grow">
                        {payment.paymentPurpose === 'Other' ? payment.otherPurpose : payment.paymentPurpose}
                        {' for Flat No- '}{payment.flatNumber}
                        {' of project '}{payment.projectName}, {project.location}.
                    </p>
                </div>
            </div>
            
            {/* Amount Box */}
            <div className="mt-8 mb-12">
                <div className="inline-block border-2 border-gray-800 px-4 py-2 rounded">
                    <span className="font-bold text-lg">TK. {payment.amount.toLocaleString('en-IN')}/=</span>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end pt-24 mt-24 text-sm">
                <div className="w-1/3 text-center">
                    <p className="border-t-2 border-gray-500 pt-2 font-bold">Received By</p>
                </div>
                <div className="w-1/3 text-center">
                </div>
                 <div className="w-1/3 text-center">
                    <p className="border-t-2 border-gray-500 pt-2 font-bold">For {company.name}</p>
                    <p>Authorized Signature</p>
                </div>
            </div>
             <p className="text-center text-xs text-gray-500 mt-4">This is a computer-generated receipt and does not require a physical signature for its validity.</p>
        </div>
    );
};
