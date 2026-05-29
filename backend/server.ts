import express from 'express'
import dotenv from 'dotenv'
import connectDB from './config/dbConnection.js'
import reviewDataRoutes from './routes/reviewData.routes.js'
import cors from 'cors'

// configuring dotenv
dotenv.config()

// creating server
const app = express()

app.use(cors({
    origin: 'http://localhost:3001'
}))
// connecting to database
connectDB()

// middleware to parse JSON
app.use(express.json())


// using routes
app.use('/api', reviewDataRoutes)

app.get('/', (req, res) => {
    res.send('API is running')
})
// creating port
const PORT = process.env.PORT || 5000

// listening to the port
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})
