const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/generate-receipt', async (req, res) => {
    try {
        const { items } = req.body;
        const doc = new PDFDocument({ size: 'A4', margin: 40 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=receipt.pdf');
        doc.pipe(res);

        const fontPath = path.join(__dirname, 'THSarabunNew.ttf');
        doc.registerFont('ThaiFont', fontPath);
        doc.font('ThaiFont');

        // ==========================================
        // หน้าที่ 1: ใบเสร็จรับสินค้า
        // ==========================================

        // --- Header Section ---
        doc.rect(0, 0, 612, 115).fill('#1e293b'); // ขยายแถบดำเป็น 115 ให้พอดี QR
        doc.fillColor('white').fontSize(24).text('WMS AUTOMATION SYSTEM', 40, 35);
        doc.fontSize(10).text('INBOUND SHIPMENT RECEIPT', 40, 65);

        // จัดการ Document No และ Date ให้ชิดซ้ายของ QR ไม่ให้ทับกัน
        const docID = `WH-INV-${Date.now().toString().slice(-6)}`;
        doc.fillColor('white').fontSize(10);
        doc.text(`Document No: ${docID}`, 300, 40, { align: 'right', width: 210 });
        doc.text(`Date: ${new Date().toLocaleDateString('th-TH')}`, 300, 55, { align: 'right', width: 210 });

        // สร้าง QR Header
        const qrHeader = await bwipjs.toBuffer({
            bcid: 'qrcode',
            text: docID,
            scale: 2
        });
        doc.image(qrHeader, 520, 25, { width: 55 }); // วางที่พิกัด x=520, y=25

        // --- Table Section ---
        const tableTop = 150;
        doc.rect(40, tableTop, 520, 25).fill('#f1f5f9');
        doc.fillColor('#475569').fontSize(12);
        doc.text('รายการสินค้า', 60, tableTop + 7);
        doc.text('รหัสสินค้า (ID)', 220, tableTop + 7);
        doc.text('จำนวน', 380, tableTop + 7);
        doc.text('น้ำหนัก (KG)', 480, tableTop + 7);

        let rowY = tableTop + 25;
        doc.fillColor('black');

        items.forEach((item, index) => {
            if (index % 2 === 0) doc.rect(40, rowY, 520, 25).fill('#ffffff');
            else doc.rect(40, rowY, 520, 25).fill('#f8fafc');

            doc.fillColor('black').fontSize(11);
            doc.text(item.name, 60, rowY + 7);
            doc.fontSize(9).text(item.id, 220, rowY + 9);
            doc.fontSize(11).text(item.qty, 380, rowY + 7);
            doc.text(item.weight, 480, rowY + 7);
            rowY += 25;
        });

        doc.rect(40, tableTop, 520, rowY - tableTop).stroke('#e2e8f0');

        // --- ส่วนท้ายกระดาษ (ล่างสุดของหน้า 1) ---
        // กำหนดตำแหน่งลายเซ็นให้คงที่ (ประมาณ 150px จากขอบล่าง)
        const footerY = 700;

        doc.fontSize(12).fillColor('black');
        doc.text('ผู้รับสินค้า: ...........................................', 60, footerY);
        doc.text('เจ้าหน้าที่คลัง: ...........................................', 350, footerY);

        // หมายเหตุ (ล่างสุดจริงๆ)
        doc.fontSize(10).fillColor('#64748b');
        doc.text('หมายเหตุ: สินค้าถูกตรวจสอบเบื้องต้นแล้ว โปรดเก็บใบเสร็จนี้ไว้เพื่อการตรวจสอบสต็อก', 40, footerY + 50, { align: 'center', width: 520 });

        // ==========================================
        // หน้าที่ 2: Labels (QR Code & Barcode)
        // ==========================================
        doc.addPage();
        doc.fillColor('black').fontSize(18).text('PRODUCT LABELS (สำหรับติดสินค้า)', { align: 'center' });
        doc.moveDown();

        let labelY = 100;
        for (const item of items) {
            // วาดกรอบ Label
            doc.roundedRect(40, labelY, 520, 140, 10).stroke('#cbd5e1');

            // ข้อมูลสินค้าใน Label
            doc.fontSize(14).font('ThaiFont').text(`สินค้า: ${item.name}`, 60, labelY + 20);
            doc.fontSize(10).text(`ID: ${item.id}`, 60, labelY + 40);

            // สร้าง QR Code (ข้อมูลสรุป)
            const qrPng = await bwipjs.toBuffer({
                bcid: 'qrcode',
                text: `ID:${item.id}\nNAME:${item.name}\nQTY:${item.qty}`,
                scale: 2
            });

            // สร้าง Barcode (สำหรับเครื่องยิงบาร์โค้ด)
            const barPng = await bwipjs.toBuffer({
                bcid: 'code128',
                text: String(item.id),
                scale: 2,
                height: 12,
                includetext: true
            });

            // วางภาพประกอบ
            doc.image(qrPng, 60, labelY + 55, { width: 65 });
            doc.image(barPng, 150, labelY + 70, { width: 280 });

            labelY += 160; // ขยับลงไปอันถัดไป

            // ถ้าพื้นที่หน้ากระดาษหมดให้ขึ้นหน้าใหม่
            if (labelY > 650) {
                doc.addPage();
                labelY = 50;
            }
        }

        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).send("PDF Error");
    }
});

app.post('/generate-outbound-receipt', async (req, res) => {
    try {
        const { cart, totalWeight } = req.body;
        const doc = new PDFDocument({ size: 'A4', margin: 40 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=outbound-order.pdf');
        doc.pipe(res);

        const fontPath = path.join(__dirname, 'THSarabunNew.ttf');
        doc.registerFont('ThaiFont', fontPath);
        doc.font('ThaiFont');

        // --- Header Section ---
        doc.rect(0, 0, 612, 115).fill('#f97316'); 
        doc.fillColor('white').fontSize(22).text('ใบเบิกสินค้า (Outbound Order)', 40, 30);
        doc.fontSize(10).text('WAREHOUSE MANAGEMENT SYSTEM - PICKING LIST', 40, 60);

        const orderID = `ORD-${Date.now().toString().slice(-6)}`;
        doc.fillColor('white').fontSize(10);
        doc.text(`Order ID: ${orderID}`, 300, 40, { align: 'right', width: 210 });
        doc.text(`Date: ${new Date().toLocaleDateString('th-TH')}`, 300, 55, { align: 'right', width: 210 });

        const qrPng = await bwipjs.toBuffer({ bcid: 'qrcode', text: orderID, scale: 2 });
        doc.image(qrPng, 520, 25, { width: 55 });

        // --- Table Header ---
        const tableTop = 160;
        doc.rect(40, tableTop, 520, 25).fill('#fff7ed');
        doc.fillColor('#9a3412').fontSize(12);
        doc.text('รายการสินค้าที่ต้องหยิบ', 60, tableTop + 7);
        doc.text('จำนวนเบิก', 350, tableTop + 7);
        doc.text('น้ำหนักรวม', 480, tableTop + 7);

        // --- Table Body ---
        let rowY = tableTop + 25;
        doc.fillColor('black');
        cart.forEach((item, index) => {
            if (index % 2 === 0) doc.rect(40, rowY, 520, 25).fill('#ffffff');
            else doc.rect(40, rowY, 520, 25).fill('#fffaf5');
            doc.fillColor('black').fontSize(11);
            doc.text(`${index + 1}. ${item.name} (ID: ${item.id})`, 60, rowY + 7);
            doc.text(`${item.orderQty} ชิ้น`, 350, rowY + 7);
            doc.text(`${(item.weight * item.orderQty).toFixed(2)} kg`, 480, rowY + 7);
            rowY += 25;
        });
        doc.rect(40, tableTop, 520, rowY - tableTop).stroke('#fed7aa');

        // สรุปน้ำหนัก (วางต่อจากตาราง)
        const summaryY = rowY + 15;
        doc.fontSize(14).font('ThaiFont').fillColor('#f97316').text(`น้ำหนักสุทธิรวม: ${totalWeight} kg`, 40, summaryY, { align: 'right', width: 520 });

        // --- Signature & Footer Section (ล่างสุดของหน้า) ---
        const footerY = 700; // ตำแหน่งเดียวกับหน้าแรก

        doc.fontSize(12).fillColor('black');
        doc.text('ผู้เบิกสินค้า: ...........................................', 60, footerY);
        doc.text('ผู้อนุมัติเบิก: ...........................................', 350, footerY);

        // Footer หมายเหตุสำหรับ Outbound
        doc.fontSize(10).fillColor('#64748b');
        doc.text('หมายเหตุ: ตรวจสอบรายการและจำนวนสินค้าให้ครบถ้วนก่อนนำออกจากคลังสินค้า หากพ้นพื้นที่คลังถือว่าการส่งมอบเสร็จสิ้น', 40, footerY + 50, { align: 'center', width: 520 });

        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).send("PDF Error");
    }
});

let racksData = [
  {
    id: 'A1',
    name: 'ZONE A-1',
    slots: [
        { id: 1, item: 'น้ำดื่ม 600ml', qty: 45, status: 'Occupied' },
        { id: 2, item: 'ปลากระป๋อง (แพ็ค)', qty: 12, status: 'Occupied' },
        { id: 3, item: null, qty: 0, status: 'Empty' },
        { id: 4, item: 'ข้าวสาร 5kg', qty: 3, status: 'Critical' }, // ใกล้หมด
        { id: 5, item: 'บะหมี่กึ่งสำเร็จรูป', qty: 120, status: 'Occupied' },
        { id: 6, item: null, qty: 0, status: 'Empty' },
        { id: 7, item: 'น้ำมันพืช 1L', qty: 24, status: 'Occupied' },
        { id: 8, item: 'ซอสปรุงรส', qty: 5, status: 'Critical' }, // ใกล้หมด
        { id: 9, item: 'นมกล่อง UHT', qty: 60, status: 'Occupied' },
    ]
  },
  {
    id: 'B1',
    name: 'ZONE B-1',
    slots: [
        { id: 1, item: 'Keyboard RGB', qty: 15, status: 'Occupied' },
        { id: 2, item: 'Mouse Wireless', qty: 2, status: 'Critical' },
        { id: 3, item: 'Monitor 24"', qty: 8, status: 'Occupied' },
        { id: 4, item: null, qty: 0, status: 'Empty' },
        { id: 5, item: 'Laptop Stand', qty: 20, status: 'Occupied' },
        { id: 6, item: 'USB-C Hub', qty: 35, status: 'Occupied' },
        { id: 7, item: null, qty: 0, status: 'Empty' },
        { id: 8, item: 'Gaming Chair', qty: 4, status: 'Occupied' },
        { id: 9, item: 'Headset 7.1', qty: 1, status: 'Critical' },
    ]
  }
];

// เพิ่ม API Route นี้
app.get('/api/racks', (req, res) => {
  res.json(racksData);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));