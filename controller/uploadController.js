const cloudinary = require('../config/cloudinary');
const User = require('../models/User');
const fs = require('fs');

// @desc    Upload avatar
// @route   POST /api/users/upload/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a file'
            });
        }

        // Delete old avatar from cloudinary if exists
        if (req.user.avatar && req.user.avatar.public_id) {
            await cloudinary.uploader.destroy(req.user.avatar.public_id);
        }

        // Upload new avatar to cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'avatars',
            width: 300,
            crop: "scale"
        });

        // Delete file from server
        fs.unlinkSync(req.file.path);

        // Update user avatar in database
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                avatar: {
                    public_id: result.public_id,
                    url: result.secure_url
                }
            },
            { new: true }
        ).select('-password');

        res.status(200).json({
            success: true,
            message: 'Avatar uploaded successfully',
            data: user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error uploading avatar',
            error: error.message
        });
    }
};

// @desc    Upload ID card
// @route   POST /api/users/upload/id-card
// @access  Private
const uploadIdCard = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a file'
            });
        }

        // Delete old ID card from cloudinary if exists
        if (req.user.idCard && req.user.idCard.public_id) {
            await cloudinary.uploader.destroy(req.user.idCard.public_id);
        }

        // Upload new ID card to cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'id_cards',
            resource_type: 'auto' // Allows PDF uploads
        });

        // Delete file from server
        fs.unlinkSync(req.file.path);

        // Update user ID card in database
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                idCard: {
                    public_id: result.public_id,
                    url: result.secure_url,
                    verified: false // Reset verification status on new upload
                }
            },
            { new: true }
        ).select('-password');

        res.status(200).json({
            success: true,
            message: 'ID card uploaded successfully, pending verification',
            data: user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error uploading ID card',
            error: error.message
        });
    }
};

module.exports = {
    uploadAvatar,
    uploadIdCard
}; 