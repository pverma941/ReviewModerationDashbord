import ReviewData from "../model/reviewDataModel.js";
import { reviewDataValidationSchema } from "../model/reviewDataModel.js";
const computeRisk = async (textContent, productId, author, rating) => {
    let score = 50;
    // 1) presence of banned/spam words
    const banned = [
        "fake",
        "scam",
        "stolen",
        "counterfeit",
        "refund",
        "chargeback",
        "dispute",
        "spam",
        "bot",
        "verified purchase not required",
        "buy now",
        "free",
        "visit",
        "click here",
        "link",
    ];
    const lowered = textContent.toLowerCase();
    let bannedHits = 0;
    for (const w of banned)
        if (lowered.includes(w))
            bannedHits++;
    score += bannedHits * 12;
    // 2) excessive uppercase characters
    const letters = textContent.replace(/[^A-Za-z]/g, "");
    if (letters.length > 0) {
        const upper = (textContent.match(/[A-Z]/g) || []).length;
        const ratio = upper / letters.length;
        if (ratio > 0.6)
            score += 18;
        else if (ratio > 0.4)
            score += 8;
    }
    // 3) multiple exclamation marks
    const excl = (textContent.match(/!/g) || []).length;
    if (excl >= 5)
        score += 18;
    else if (excl >= 3)
        score += 10;
    // 4) very short or meaningless text
    if (textContent.length < 10)
        score += 25;
    else if (textContent.length < 30)
        score += 8;
    // 5) repeated characters (e.g., loooove)
    if (/(.)\1{3,}/.test(textContent))
        score += 12;
    // 6) multiple reviews by same author for same product in short time (24h)
    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await ReviewData.countDocuments({
            productId,
            author,
            createdAt: { $gte: since },
        });
        if (recent >= 1)
            score += 22;
    }
    catch (e) {
        // ignore DB errors
    }
    // rating influence
    if (typeof rating === "number") {
        if (rating <= 2)
            score += 15;
        else if (rating === 3)
            score += 6;
        else if (rating === 5)
            score -= 8;
    }
    // clamp
    return Math.max(0, Math.min(100, Math.round(score)));
};
// controller to create review data
export const createReviewData = async (req, res) => {
    try {
        console.log("Received review data:", req.body);
        const validatedData = reviewDataValidationSchema.parse(req.body);
        if (!validatedData)
            return res.status(400).json({ error: "Invalid review data" });
        const { productId, author, rating, text } = validatedData;
        const textContent = (text || "").trim();
        // Heuristic risk scoring function
        const riskScore = await computeRisk(textContent, productId, author, rating);
        const saveData = {
            productId,
            author,
            rating,
            text,
            riskScore,
            status: "pending",
            createdAt: new Date(),
            flag: [],
            moderatorReason: "",
        };
        const reviewData = new ReviewData(saveData);
        await reviewData.save();
        return res.status(201).json({
            message: "Review data created successfully",
            success: true
        });
    }
    catch (error) {
        return res
            .status(400)
            .json({ error: error?.errors || error?.message || String(error) });
    }
};
// controller to get all review data /reviews?page=1&limit=10
export const getAllReviewData = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const reviews = await ReviewData.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await ReviewData.countDocuments();
        return res.status(200).json({
            data: reviews,
            total,
            page,
            limit
        });
    }
    catch (error) {
        return res.status(500).json({ error: "Server error" });
    }
};
export const updateReviewData = async (req, res) => {
    try {
        console.log(req.params);
        console.log(req.body);
        const { id } = req.params;
        // checking req.params have and id and atlease one of text or rating
        if (!id)
            return res.status(400).json({ error: "ID is required" });
        const updateFields = {};
        if (req.body.text)
            updateFields.text = req.body.text;
        if (req.body.rating)
            updateFields.rating = req.body.rating;
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ error: "At least one field (text or rating) is required for update" });
        }
        else {
            // find by product id
            const existing = await ReviewData.findOne({ productId: id });
            if (!existing)
                return res.status(404).json({ error: "Review data not found" });
            const { productId, author } = existing;
            const riskScore = await computeRisk(updateFields.text, productId, author, updateFields.rating);
            updateFields.riskScore = riskScore;
            const reviewData = await ReviewData.updateOne({ productId: id }, updateFields);
            if (!reviewData)
                return res.status(404).json({ error: "Review data not found" });
            return res.status(200).json({
                message: "Review data updated successfully",
                success: true
            });
        }
    }
    catch (error) {
        return res.status(400).json({ error: "Invalid data" });
    }
};
export const approveReviewData = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id)
            return res.status(400).json({ error: "ID is required" });
        // 1. Add runValidators: true to enforce schema rules
        // 2. Use $set operator for clarity and safety
        const result = await ReviewData.updateOne({ productId: id }, { $set: { status: "approved" } }, { runValidators: true });
        // 3. Check matchedCount instead of the result object itself
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Review data not found" });
        }
        return res.status(200).json({
            message: "Review data approved successfully",
            success: true
        });
    }
    catch (error) {
        // 4. Distinguish between validation errors and other errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: "Validation failed",
                details: error.errors
            });
        }
        return res.status(500).json({ error: "Internal server error" });
    }
};
export const rejectReviewData = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !req.body.reason)
            return res.status(400).json({ error: "incomplete data" });
        const reviewData = await ReviewData.updateOne({ productId: id }, { $set: { status: "rejected", moderatorReason: req.body.reason } }, { runValidators: true });
        if (!reviewData)
            return res.status(404).json({ error: "Review data not found" });
        return res.status(200).json({
            message: "Review data rejected successfully",
            success: true
        });
    }
    catch (error) {
        return res.status(400).json({ error: "Invalid data" });
    }
};
// function to get flagged review data flagged greater than 60
export const getFlaggedReviewData = async (req, res) => {
    try {
        const flaggedReviews = await ReviewData.find({ riskScore: { $gt: 60 } }).sort({ createdAt: -1 });
        return res.status(200).json({
            data: flaggedReviews
        });
    }
    catch (error) {
        return res.status(400).json({ error: "Invalid data" });
    }
};
