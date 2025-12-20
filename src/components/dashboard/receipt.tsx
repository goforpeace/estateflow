'use client';

import React from 'react';
import type { Customer, InflowTransaction } from '@/lib/types';
import Image from 'next/image';

interface ReceiptProps {
    payment: InflowTransaction & { customerName: string, projectName: string, flatNumber: string };
    customer: Customer;
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
    if (n === 0) return 'zero';

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

    return str.trim().replace(/\s+/g, ' ') + ' only';
};


export const Receipt: React.FC<ReceiptProps> = ({ payment, customer }) => {
    const company = {
        name: 'Landmark New Homest Ltd.',
        logo: 'https://res.cloudinary.com/dj4lirc0d/image/upload/Artboard_1_pabijh.png',
        website: 'www.landmarkltd.net',
        email: 'info@landmarkltd.net',
        facebook: 'www.facebook.com/landmarkltd.net'
    };

    const amountInWords = numberToWords(payment.amount);

    return (
        <div className="p-8 bg-white font-sans a4-page mx-auto shadow-lg">
            <style jsx global>{`
                .a4-page {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto;
                }
            `}</style>
            
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b-2 border-gray-300">
                <div className="w-40 h-auto">
                    <img src={company.logo} alt="Company Logo" className="w-full h-auto" />
                </div>
                <div className="text-right">
                    <h1 className="text-3xl font-bold text-gray-800">{company.name}</h1>
                    <p className="text-sm text-gray-500">{company.website} | {company.email}</p>
                    <p className="text-sm text-gray-500">{company.facebook}</p>
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
                    <p className="border-b border-dotted border-gray-400 flex-grow">{customer.fullName}</p>
                </div>
                <div className="flex items-baseline">
                    <p className="w-48 font-semibold shrink-0">the sum of Taka</p>
                    <p className="border-b border-dotted border-gray-400 flex-grow capitalize">{amountInWords}</p>
                </div>
                 <div className="flex items-baseline">
                    <p className="w-48 font-semibold shrink-0">by</p>
                    <p className="border-b border-dotted border-gray-400 flex-grow">{payment.paymentMethod}{payment.reference ? ` (${payment.reference})`: ''}</p>
                </div>
                 <div className="flex items-baseline">
                    <p className="w-48 font-semibold shrink-0">on account of</p>
                    <p className="border-b border-dotted border-gray-400 flex-grow">
                        {payment.paymentPurpose === 'Other' ? payment.otherPurpose : payment.paymentPurpose}
                        {' for Flat '}{payment.flatNumber}
                        {' in Project '}{payment.projectName}
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
            <div className="flex justify-between items-end pt-16 mt-16 text-sm">
                <div className="w-1/3 text-center">
                    <p className="border-t-2 border-gray-400 pt-2 font-bold">Received By</p>
                </div>
                <div className="w-1/3 text-center">
                </div>
                 <div className="w-1/3 text-center">
                    <p className="border-t-2 border-gray-400 pt-2 font-bold">Authorized Signature</p>
                </div>
            </div>
             <p className="text-center text-xs text-gray-500 mt-4">This is a computer-generated receipt and does not require a physical signature.</p>

        </div>
    );
};
