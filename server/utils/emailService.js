const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

/**
 * Helper to create a dynamic transporter based on store config or environment fallback
 */
const getTransporter = async (store) => {
  // 1. If store has valid email config in DB, use store's Gmail/SMTP
  const storeEmail = store?.emailConfig?.email?.trim();
  const storePass = store?.emailConfig?.appPassword?.trim();
  if (storeEmail && storePass) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: storeEmail,
          pass: storePass
        }
      }),
      fromEmail: storeEmail,
      isReal: true
    };
  }

  // 2. Global fallback to process.env credentials
  const envEmail = process.env.EMAIL_USER?.trim();
  const envPass = process.env.EMAIL_PASS?.trim();
  if (envEmail && envPass) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: envEmail,
          pass: envPass
        }
      }),
      fromEmail: envEmail,
      isReal: true
    };
  }

  // 3. Fallback to Ethereal test account (for dev sandbox only)
  try {
    const account = await nodemailer.createTestAccount();
    return {
      transporter: nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass
        }
      }),
      fromEmail: account.user,
      isReal: false
    };
  } catch (err) {
    console.error('[EMAIL] Failed to create ethereal test account:', err.message);
    return null;
  }
};

/**
 * Verify current email configuration
 */
const verifyEmailConfig = async (store) => {
  try {
    const transportData = await getTransporter(store);
    if (!transportData || !transportData.transporter) {
      return { success: false, error: 'No email service or credentials configured' };
    }
    await transportData.transporter.verify();
    return {
      success: true,
      fromEmail: transportData.fromEmail,
      isReal: transportData.isReal
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Generates a PDF bill in memory and returns a Buffer
 */
const generatePDF = (sale, storeName) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      const displayName = storeName || 'RetailIQ Store';
      doc.fontSize(20).font('Helvetica-Bold').text(displayName, { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('Tax Invoice / Bill of Supply', { align: 'center' });
      doc.moveDown();

      // Bill details
      const dateStr = sale.createdAt ? new Date(sale.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
      const billIdStr = sale._id ? sale._id.toString() : 'N/A';
      const cashierName = sale.staff?.name || 'Staff';
      const paymentStr = (sale.paymentMethod || 'cash').toUpperCase();

      doc.fontSize(10)
         .text(`Bill No: ${billIdStr}`)
         .text(`Date: ${dateStr}`)
         .text(`Cashier: ${cashierName}`)
         .text(`Payment: ${paymentStr}`);

      const custName = sale.customer?.name || sale.customerName;
      if (custName) {
        doc.text(`Customer: ${custName}`);
      }
      const custContact = sale.customer?.email || sale.customerEmail || sale.customer?.phone || sale.customerPhone;
      if (custContact) {
        doc.text(`Contact: ${custContact}`);
      }
      doc.moveDown();

      // Table Header
      const tableTop = doc.y;
      doc.font('Helvetica-Bold')
         .text('Item', 50, tableTop)
         .text('Qty', 300, tableTop)
         .text('Price', 360, tableTop)
         .text('Total', 450, tableTop);
      
      doc.moveTo(50, doc.y + 5).lineTo(500, doc.y + 5).stroke();
      doc.moveDown(0.5);

      // Items
      let y = doc.y;
      doc.font('Helvetica');
      (sale.products || []).forEach(item => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        const productName = item.product?.name || item.name || 'Unknown Item';
        const qtyStr = (item.qty || 1).toString();
        const price = typeof item.price === 'number' ? item.price : 0;
        const lineTotal = (item.qty || 1) * price;

        doc.text(productName, 50, y, { width: 240 })
           .text(qtyStr, 300, y)
           .text(`Rs. ${price.toFixed(2)}`, 360, y)
           .text(`Rs. ${lineTotal.toFixed(2)}`, 450, y);
        y += 18;
      });

      doc.moveTo(50, y + 5).lineTo(500, y + 5).stroke();
      
      // Totals
      const totalAmount = typeof sale.total === 'number' ? sale.total : 0;
      doc.fontSize(12).font('Helvetica-Bold')
         .text('Grand Total:', 300, y + 15)
         .text(`Rs. ${totalAmount.toFixed(2)}`, 400, y + 15, { align: 'right' });

      doc.moveDown(2);
      doc.fontSize(10).font('Helvetica').text('Thank you for shopping with us!', { align: 'center' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Sends an email with the PDF attached
 * @param {Object} sale - The sale document (or populated object)
 * @param {Object} store - The store document
 * @param {String} [targetEmail] - Optional target recipient email address
 */
const sendBillEmail = async (sale, store, targetEmail = null) => {
  const recipientEmail = (targetEmail || sale.customer?.email || sale.customerEmail)?.trim();
  if (!recipientEmail) {
    return { success: false, error: 'No customer email address provided' };
  }

  const transportData = await getTransporter(store);
  if (!transportData || !transportData.transporter) {
    return { success: false, error: 'Email service configuration unavailable. Check server email settings.' };
  }

  const { transporter, fromEmail, isReal } = transportData;
  const storeName = store?.name || 'Retail Store';
  const customerName = sale.customer?.name || sale.customerName || 'Valued Customer';
  const billShortId = sale._id ? sale._id.toString().slice(-6) : '';

  try {
    const pdfBuffer = await generatePDF(sale, storeName);

    const mailOptions = {
      from: `"${storeName}" <${fromEmail}>`,
      to: recipientEmail,
      subject: `Invoice for Bill #${billShortId} - ${storeName}`,
      text: `Hello ${customerName},\n\nThank you for shopping at ${storeName}!\n\nPlease find attached the tax invoice for your purchase.\n\nBill ID: ${sale._id}\nTotal Amount: Rs. ${sale.total}\nPayment Method: ${(sale.paymentMethod || 'cash').toUpperCase()}\n\nWarm regards,\n${storeName}`,
      attachments: [
        {
          filename: `Invoice_${sale._id || 'bill'}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (!isReal) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`📧 [TEST EMAIL] Generated for ${recipientEmail}. Preview: ${previewUrl}`);
      return { success: true, previewUrl, recipient: recipientEmail, isTest: true };
    } else {
      console.log(`📧 [REAL EMAIL] Sent successfully to ${recipientEmail} from ${fromEmail}`);
      return { success: true, previewUrl: null, recipient: recipientEmail, isTest: false }; 
    }
  } catch (error) {
    console.error(`[EMAIL] Error sending bill email to ${recipientEmail}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendBillEmail, generatePDF, verifyEmailConfig, getTransporter };

