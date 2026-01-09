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
            <div className="p-8 w-[210mm] min-h-[297mm] mx-auto">
                <header className="flex justify-between items-start mb-8">
                    {/* Left side: Receipt Title and Customer Info */}
                    <div className="w-1/2">
                        <h2 className="text-3xl font-semibold mb-4">RECEIPT</h2>
                        <div className="text-sm">
                            <p className="font-bold">{customer.fullName}</p>
                            <p>{customer.address}</p>
                        </div>
                    </div>

                    {/* Right side: Logo, Company Info, and Payment Details */}
                    <div className="w-1/2 text-right">
                        <div className="flex justify-end mb-4">
                            <img src={company.logo} alt={`${company.name} Logo`} className="h-16" />
                        </div>
                        <div className="text-xs mb-4">
                            <p className="font-bold">{company.name}</p>
                            <p>{company.address}</p>
                            <p>Email: {company.email}</p>
                            <p>Tel: {company.phone}</p>
                        </div>
                        <table className="w-full text-sm">
                            <tbody>
                                <tr>
                                    <td className="font-semibold pr-4">Payment Date</td>
                                    <td>{new Date(payment.date).toLocaleDateString('en-GB')}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold pr-4">Receipt No</td>
                                    <td>{payment.receiptId}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </header>

                <div className="border-t-2 border-black pt-2 mb-8">
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total Amount paid</span>
                        <span>৳{payment.amount.toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <main>
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b-2 border-black">
                                <th className="pb-2 w-[20%]">Payment Date</th>
                                <th className="pb-2 w-[40%]">Description</th>
                                <th className="pb-2 w-[20%] text-right">Payment Method</th>
                                <th className="pb-2 w-[20%] text-right">Amount Paid</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="pt-2">{new Date(payment.date).toLocaleDateString('en-GB')}</td>
                                <td className="pt-2">
                                    {payment.paymentPurpose === 'Other' ? payment.otherPurpose : payment.paymentPurpose}
                                    {' for Flat '}{payment.flatNumber}
                                    {' in project '}{payment.projectName}
                                </td>
                                <td className="pt-2 text-right">{payment.paymentMethod}</td>
                                <td className="pt-2 text-right">৳{payment.amount.toLocaleString('en-IN')}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex justify-end mt-4">
                        <table className="w-2/5 text-sm">
                            <tbody>
                                <tr className="border-t-2 border-black">
                                    <td className="pt-2 font-bold">Total</td>
                                    <td className="pt-2 text-right font-bold">৳{payment.amount.toLocaleString('en-IN')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </main>
            </div>
        </div>
    );
}
