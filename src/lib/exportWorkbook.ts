export type WorkbookSheet = {
  name: string
  rows: Array<Record<string, unknown>>
}

function safeSheetName(name: string) {
  return (name || 'Sheet').replace(/[\\/:*?\[\]]/g, '_').slice(0, 31) || 'Sheet'
}

function collectHeaders(rows: Array<Record<string, unknown>>) {
  const seen = new Set<string>()
  const headers: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }
  return headers
}

function estimateWidth(header: string, rows: Array<Record<string, unknown>>) {
  let max = String(header).length
  for (const row of rows.slice(0, 300)) {
    const value = row[header]
    const text = value === null || value === undefined ? '' : String(value)
    if (text.length > max) max = text.length
  }
  return Math.min(34, Math.max(11, Math.ceil(max * 1.15)))
}

export async function exportJsonWorkbook(fileName: string, sheets: WorkbookSheet[]) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ScoutSVM'
  workbook.created = new Date()

  const headerFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFF4D471' },
  }
  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
  }

  for (const sheetDef of sheets) {
    const rows = sheetDef.rows.length ? sheetDef.rows : [{ الحالة: 'لا توجد بيانات' }]
    const headers = collectHeaders(rows)
    const worksheet = workbook.addWorksheet(safeSheetName(sheetDef.name))

    worksheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }]
    worksheet.columns = headers.map((header) => ({
      key: header,
      header,
      width: estimateWidth(header, rows),
    }))

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FF0F1A36' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'right' }
    headerRow.height = 24
    headerRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.border = thinBorder
    })

    for (const row of rows) {
      const added = worksheet.addRow(row)
      added.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true }
      added.eachCell((cell) => {
        cell.border = thinBorder
      })
    }

    if (headers.length) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
