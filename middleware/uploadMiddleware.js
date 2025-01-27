const multer = require('multer');
const path = require('path');

// Multer config
const storage = multer.diskStorage({
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    if (file.fieldname === "avatar") {
        // Allow only images for avatar
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Avatar must be an image file'), false);
        }
    } else if (file.fieldname === "idCard") {
        // Allow images and PDFs for ID card
        if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
            return cb(new Error('ID card must be an image or PDF file'), false);
        }
    }
    cb(null, true);
};

// Upload middleware
const upload = multer({
    storage: storage,
    limits: { fileSize: 10000000 }, // 10mb
    fileFilter: fileFilter
});

module.exports = { upload }; 