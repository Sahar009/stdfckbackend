const nodemailer = require('nodemailer');
const path = require('path');
const ejs = require('ejs');
const fs = require('fs');

// Create transporter function
const createTransporter = () => {
    return nodemailer.createTransport({
        host: 'mail.unityfinance.online',      
        port: 465,       
        secure: true,                     

        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS 
        },
        tls: {
            // Do not fail on invalid certs
            rejectUnauthorized: false
        }
    });
};

// Generic send email function
const sendEmail = async (to, subject, template, context) => {
    try {
        // console.log('Creating transporter...');
        const transporter = createTransporter();
        
        // console.log('Reading template:', template);
        const templatePath = path.join(__dirname, '../views/emails', `${template}.ejs`);
        
        // Check if template exists
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`);
        }
        
        // console.log('Compiling template...');
        const html = await ejs.renderFile(templatePath, context);

        const mailOptions = {
            from: {
                name: 'Unity Finance',
                address: 'support@unityfinance.online'
            },
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
            html: html,
            headers: {
                'List-Unsubscribe': `<mailto:unsubscribe@unityfinance.online>`,
                'Precedence': 'bulk',
                'X-Auto-Response-Suppress': 'OOF, AutoReply',
                'Organization': 'Unity Finance'
            }
        };

        // console.log('Sending email with options:', {
        //     to: mailOptions.to,
        //     subject: mailOptions.subject,
        //     from: mailOptions.from
        // });

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully. Message ID:', result.messageId);
        return result;
    } catch (error) {
        console.error('Detailed error in sendEmail:', {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response
        });
        throw error;
    }
};

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

const sendLoginOTP = async (userEmail, otp) => {
    await sendEmail(
        userEmail,
        'Login OTP Verification',
        'loginOTP',
        {
            otp,
            expiresIn: '10 minutes'
        }
    );
};

// Add this test function with more detailed logging
const testEmailConnection = async () => {
    try {
        console.log('Starting email server test...');
        
        const transporter = createTransporter();
        console.log('Transporter created');
        
        // Verify connection configuration
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('Server connection verified successfully');
        
        // Test email with more detailed error handling
        try {
            await sendEmail(
                'sehindeshoes@gmail.com', // Replace with your test email
                'Test Email from Unity Finance',
                'registrationPending',  // Make sure this template exists
                {
                    firstName: 'Test',
                    lastName: 'User',
                    accountNumber: '000000',
                    email: 'test@example.com'
                }
            );
            console.log('Test email sent successfully');
        } catch (emailError) {
            console.error('Detailed email error:', {
                message: emailError.message,
                code: emailError.code,
                command: emailError.command,
                response: emailError.response
            });
            throw emailError;
        }
        
    } catch (error) {
        console.error('Email server test failed with error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
};

module.exports = {
    sendMoneyReceivedEmail,
    sendRegistrationEmail,
    sendAccountApprovedEmail,
    sendAdminCreditEmail,
    testEmailConnection,
    sendEmail,  // Export the generic sendEmail function too
    sendLoginOTP
}; 