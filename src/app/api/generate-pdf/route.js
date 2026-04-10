// app/api/generate-pdf/route.js
// Принимает POST с JSON данными тура → возвращает PDF файл

import { NextResponse } from 'next/server'
import { spawn }        from 'child_process'
import { readFile, unlink, writeFile } from 'fs/promises'
import { join }         from 'path'

const SCRIPT_PATH = join(process.cwd(), 'scripts', 'generate_pdf.py')
const FONT_DIR    = join(process.cwd(), 'scripts', 'fonts')

export async function POST(request) {
  try {
    const data = await request.json()

    if (!data?.meta?.order_id || !data?.passengers?.length) {
      return NextResponse.json({ error: 'Неверный формат данных' }, { status: 400 })
    }

    const orderId  = data.meta.order_id
    const jsonPath = `/tmp/trip_${orderId}_${Date.now()}.json`
    const pdfPath  = `/tmp/trip_${orderId}.pdf`

    await writeFile(jsonPath, JSON.stringify(data), 'utf-8')

    await new Promise((resolve, reject) => {
      const py = spawn('python3', [SCRIPT_PATH, jsonPath, pdfPath], {
        env: { ...process.env, FONT_DIR }
      })
      let stderr = ''
      py.stderr.on('data', d => stderr += d.toString())
      py.on('close', code => {
        if (code !== 0) reject(new Error(`PDF generator error:\n${stderr}`))
        else resolve(pdfPath)
      })
    })

    const pdfBuffer = await readFile(pdfPath)
    await Promise.allSettled([unlink(jsonPath), unlink(pdfPath)])

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="trip_${orderId}.pdf"`,
        'Content-Length':      pdfBuffer.length.toString(),
      }
    })

  } catch (err) {
    console.error('PDF generation failed:', err)
    return NextResponse.json({ error: 'Не удалось сгенерировать PDF' }, { status: 500 })
  }
}
