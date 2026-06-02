import 'dotenv/config'
import mongoose from 'mongoose'
import { startCardWorker } from './cardWorker'
import { startCampaignWorker } from './campaignWorker'

const start = async () => {
  const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/champqr'
  await mongoose.connect(MONGODB_URI)
  console.log('[worker process] MongoDB connected')

  const cardWorker = startCardWorker()
  const campaignWorker = startCampaignWorker()
  console.log('[worker process] Card + Campaign processing workers started')

  process.on('SIGTERM', async () => {
    await Promise.all([cardWorker.close(), campaignWorker.close()])
    await mongoose.disconnect()
    process.exit(0)
  })
}

start().catch((err) => { console.error(err); process.exit(1) })
