import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const uploadsDir = path.join(__dirname, '../../uploads')

export async function compileMindARTarget(qrPngUrl: string, slug: string): Promise<string> {
  const qrFilename = qrPngUrl.replace(/.*\/files\//, '')
  const qrAbsPath = path.join(uploadsDir, qrFilename)

  if (!fs.existsSync(qrAbsPath)) {
    throw new Error(`QR PNG not found at ${qrAbsPath}`)
  }

  const outDir = path.join(uploadsDir, 'mind')
  fs.mkdirSync(outDir, { recursive: true })

  const mindFilename = `${slug}.mind`
  const mindOutPath = path.join(outDir, mindFilename)

  // Use the MindAR image compiler CLI
  // Installed via: node_modules/.bin/mindar-image-targets-compiler
  const compilerPath = path.join(__dirname, '../../../node_modules/.bin/mindar-image-targets-compiler')

  try {
    await execFileAsync('node', [
      compilerPath,
      '--input', qrAbsPath,
      '--output', mindOutPath,
    ], { timeout: 60000 })
  } catch {
    // Fallback: try direct node compilation using mind-ar internals
    await compileFallback(qrAbsPath, mindOutPath)
  }

  if (!fs.existsSync(mindOutPath)) {
    throw new Error('MindAR compilation produced no output file')
  }

  const base = process.env.FILE_BASE_URL ?? 'http://localhost:3001/files'
  return `${base}/mind/${mindFilename}`
}

async function compileFallback(imagePath: string, outputPath: string) {
  const { createTargetFromImages } = await import('mind-ar/dist/mindar-image.prod.js' as any)
    .catch(() => { throw new Error('mind-ar not available for server-side compilation') })

  const sharp = (await import('sharp')).default
  const imgBuffer = fs.readFileSync(imagePath)
  const { data, info } = await sharp(imgBuffer).raw().toBuffer({ resolveWithObject: true })

  const result = await createTargetFromImages([{
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  }])

  fs.writeFileSync(outputPath, Buffer.from(result))
}
