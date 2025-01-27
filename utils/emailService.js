const nodemailer = require('nodemailer');
const path = require('path');
const ejs = require('ejs');

// Create transporter function
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });
};

// Generic send email function
const sendEmail = async (to, subject, template, context) => {
    try {
        const transporter = createTransporter();
        
        // Read and compile the EJS template
        const templatePath = path.join(__dirname, '../views/emails', `${template}.ejs`);
        const html = await ejs.renderFile(templatePath, context);

        const mailOptions = {
            from: {
                name: 'Your Bank Name',
                address: process.env.SMTP_USER
            },
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
            html: html
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

// Specific email functions using the generic sendEmail
const sendMoneyReceivedEmail = async (userEmail, data) => {
    await sendEmail(
        userEmail,
        'Money Received!',
        'moneyReceived',
        {
            receiverName: data.receiverName,
            senderName: data.senderName,
            amount: data.amount,
            reference: data.reference,
            description: data.description,
            date: data.date,
            newBalance: data.newBalance
        }
    );
};

const sendRegistrationEmail = async (userEmail, data) => {
    await sendEmail(
        userEmail,
        'Welcome to Our Banking Service - Account Pending Verification',
        'registrationPending',
        {
            firstName: data.firstName,
            lastName: data.lastName,
            accountNumber: data.accountNumber,
            email: data.email
        }
    );
};

const sendAccountApprovedEmail = async (userEmail, data) => {
    await sendEmail(
        userEmail,
        'Congratulations! Your Account is Now Active',
        'accountApproved',
        {
            firstName: data.firstName,
            lastName: data.lastName,
            accountNumber: data.accountNumber,
            email: data.email,
            loginUrl: process.env.FRONTEND_URL + '/login'
        }
    );
};

const sendAdminCreditEmail = async (userEmail, data) => {
    await sendEmail(
        userEmail,
        'Your Account Has Been Credited',
        'adminCredit',
        {
            userName: data.userName,
            amount: data.amount,
            reference: data.reference,
            description: data.description,
            date: data.date,
            newBalance: data.newBalance
        }
    );
};

module.exports = {
    sendMoneyReceivedEmail,
    sendRegistrationEmail,
    sendAccountApprovedEmail,
    sendAdminCreditEmail
}; 