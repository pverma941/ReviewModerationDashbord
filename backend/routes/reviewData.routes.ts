// creating routes for review data
import express from 'express'
import { approveReviewData, createReviewData, getAllReviewData, getFlaggedReviewData, rejectReviewData, updateReviewData } from '../controller/reviewData.controller.js'
import { get } from 'http'
import { getActiveResourcesInfo } from 'process'

const router = express.Router()

// route to create review data
console.log("router called");

router.post('/createReviews', createReviewData)

// route to get all review data /reviews?page=1&limit=10
router.get('/reviews', getAllReviewData)

// route to update review data
router.put('/reviews/:id', updateReviewData)

// route to approve review data
router.post('/reviews/:id/approve', approveReviewData)

// route to reject review data
router.post('/reviews/:id/reject', rejectReviewData)

// route to get flagged review data flagged greater than 60
router.get('/reviews/flagged', getFlaggedReviewData);

export default router