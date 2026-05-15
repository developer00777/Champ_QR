import { Worker } from 'bullmq'
import Card from '../models/Card'
import { transcodeVideo } from './transcode'
import { generateQR } from './generateQR'
import { buildPrintPack } from './buildPrintPack'
import { compileMindARTarget } from './compileMindAR'
import { emitCardStatus } from '../lib/wsEmitter'

function getRedisConnection() {
  if (process.env.REDIS_URL) return { url: process.env.REDIS_URL }
  return { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) }
}

export function startCardWorker() {
  const worker = new Worker(
    'card-processing',
    async (job) => {
      const { cardId, videoPath } = job.data
      console.log(`[worker] Processing card ${cardId}`)

      const card = await Card.findById(cardId)
      if (!card) throw new Error(`Card ${cardId} not found`)

      try {
        // Step 1: Transcode
        await job.updateProgress(10)
        const { videoUrl, thumbnailUrl } = await transcodeVideo(videoPath, card.slug)
        await Card.findByIdAndUpdate(cardId, { videoUrl, thumbnailUrl })
        emitCardStatus(cardId, 'processing:transcoded')

        // Step 2: Generate QR
        await job.updateProgress(35)
        const { qrPngUrl, qrSvgPath } = await generateQR(card.slug)
        await Card.findByIdAndUpdate(cardId, { qrImageUrl: qrPngUrl })
        emitCardStatus(cardId, 'processing:qr')

        // Step 3: Print pack
        await job.updateProgress(55)
        const printPackUrl = await buildPrintPack(card.slug, qrPngUrl, qrSvgPath, card.ownerName)
        await Card.findByIdAndUpdate(cardId, { printPackUrl })
        emitCardStatus(cardId, 'processing:printpack')

        // Step 4: Compile MindAR target
        await job.updateProgress(75)
        const targetFileUrl = await compileMindARTarget(qrPngUrl, card.slug)
        await Card.findByIdAndUpdate(cardId, { targetFileUrl })
        emitCardStatus(cardId, 'processing:ar')

        // Step 5: Mark ready
        await job.updateProgress(100)
        await Card.findByIdAndUpdate(cardId, { status: 'ready', errorMsg: '' })
        emitCardStatus(cardId, 'ready')
        console.log(`[worker] Card ${cardId} ready`)

      } catch (err: any) {
        console.error(`[worker] Card ${cardId} failed:`, err.message)
        await Card.findByIdAndUpdate(cardId, { status: 'error', errorMsg: err.message ?? 'Processing failed' })
        emitCardStatus(cardId, 'error')
        throw err
      }
    },
    { connection: getRedisConnection(), concurrency: 2 }
  )

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.id} failed permanently:`, err.message)
  })

  return worker
}
