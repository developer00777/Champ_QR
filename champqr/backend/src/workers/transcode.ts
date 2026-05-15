import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

// Use ffmpeg-static if available, otherwise fall back to system ffmpeg (Docker)
try {
  const ffmpegStatic = require('ffmpeg-static')
  if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic)
} catch {
  // System ffmpeg is on PATH (e.g. Docker image has ffmpeg installed via apk)
}

const uploadsDir = path.join(__dirname, '../../uploads')

export async function transcodeVideo(inputPath: string, slug: string): Promise<{ videoUrl: string; thumbnailUrl: string }> {
  const outDir = path.join(uploadsDir, 'videos', 'processed')
  fs.mkdirSync(outDir, { recursive: true })

  const videoFilename = `${slug}.mp4`
  const thumbFilename = `${slug}-thumb.jpg`
  const videoOut = path.join(outDir, videoFilename)
  const thumbOut = path.join(outDir, thumbFilename)

  const localInput = inputPath.replace(/.*\/files\//, '')
  const absoluteInput = path.join(uploadsDir, localInput)

  await new Promise<void>((resolve, reject) => {
    ffmpeg(absoluteInput)
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoBitrate('1200k')
      .audioBitrate('128k')
      .size('?x720')
      .outputOptions([
        '-crf 23',
        '-preset fast',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(videoOut)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })

  // Extract thumbnail at 0s
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoOut)
      .screenshots({ timestamps: ['00:00:00.000'], filename: thumbFilename, folder: outDir, size: '640x360' })
      .on('end', resolve)
      .on('error', reject)
  })

  const base = process.env.FILE_BASE_URL ?? 'http://localhost:3001/files'
  return {
    videoUrl: `${base}/videos/processed/${videoFilename}`,
    thumbnailUrl: `${base}/videos/processed/${thumbFilename}`,
  }
}
