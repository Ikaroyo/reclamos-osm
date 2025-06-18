import { useState, useEffect } from 'react'
import { supabase, Distributor, checkIsAdmin } from '../lib/supabase'
import * as XLSX from 'xlsx'

export default function DistributorManager() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [filteredDistributors, setFilteredDistributors] = useState<Distributor[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [newDistributor, setNewDistributor] = useState({ calle: '', repartidor: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingData, setEditingData] = useState({ calle: '', repartidor: '' })
  const [callesSuggestions, setCallesSuggestions] = useState<string[]>([])
  const [repartidoresSuggestions, setRepartidoresSuggestions] = useState<string[]>([])
  const [showCalleSuggestions, setShowCalleSuggestions] = useState(false)
  const [showRepartidorSuggestions, setShowRepartidorSuggestions] = useState(false)
  const [selectedDistributors, setSelectedDistributors] = useState<number[]>([])
  const [bulkRepartidor, setBulkRepartidor] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showImportInfo, setShowImportInfo] = useState(false)

  useEffect(() => {
    checkAdminAccess()
  }, [])

  useEffect(() => {
    filterDistributors()
  }, [distributors, searchTerm])

  const checkAdminAccess = async () => {
    const adminStatus = await checkIsAdmin()
    setIsAdmin(adminStatus)
    setLoading(false)
    
    if (adminStatus) {
      fetchDistributors()
    }
  }

  const fetchDistributors = async () => {
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('calle', { ascending: true })

    if (error) {
      console.error('Error fetching distributors:', error)
    } else {
      setDistributors(data || [])
    }
  }

  const filterDistributors = () => {
    if (!searchTerm) {
      setFilteredDistributors(distributors)
    } else {
      const filtered = distributors.filter(distributor =>
        distributor.calle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        distributor.repartidor.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredDistributors(filtered)
    }
  }

  const handleCalleChange = (value: string) => {
    setNewDistributor({ ...newDistributor, calle: value })
    
    if (value.length > 0) {
      const filtered = distributors
        .filter(d => d.calle.toLowerCase().includes(value.toLowerCase()))
        .map(d => d.calle)
      setCallesSuggestions([...new Set(filtered)])
      setShowCalleSuggestions(true)
    } else {
      setCallesSuggestions([])
      setShowCalleSuggestions(false)
    }
  }

  const handleRepartidorChange = (value: string) => {
    setNewDistributor({ ...newDistributor, repartidor: value })
    
    if (value.length > 0) {
      const filtered = distributors
        .filter(d => d.repartidor.toLowerCase().includes(value.toLowerCase()))
        .map(d => d.repartidor)
      setRepartidoresSuggestions([...new Set(filtered)])
      setShowRepartidorSuggestions(true)
    } else {
      setRepartidoresSuggestions([])
      setShowRepartidorSuggestions(false)
    }
  }

  const handleCalleSelect = (calle: string) => {
    setNewDistributor({ ...newDistributor, calle })
    setShowCalleSuggestions(false)
  }

  const handleRepartidorSelect = (repartidor: string) => {
    setNewDistributor({ ...newDistributor, repartidor })
    setShowRepartidorSuggestions(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newDistributor.calle || !newDistributor.repartidor) return

    // Check for exact matches
    const exactMatch = distributors.find(d => 
      d.calle.toLowerCase().trim() === newDistributor.calle.toLowerCase().trim()
    )

    if (exactMatch) {
      const shouldOverwrite = confirm(
        `La calle "${newDistributor.calle}" ya existe con el repartidor "${exactMatch.repartidor}".\n\n` +
        `¿Desea sobrescribir con el nuevo repartidor "${newDistributor.repartidor}"?`
      )

      if (shouldOverwrite) {
        const { error } = await supabase
          .from('distributors')
          .update({ repartidor: newDistributor.repartidor })
          .eq('id', exactMatch.id)

        if (error) {
          alert('Error al actualizar: ' + error.message)
        } else {
          setNewDistributor({ calle: '', repartidor: '' })
          fetchDistributors()
          alert('Repartidor actualizado exitosamente')
        }
      }
      setShowCalleSuggestions(false)
      setShowRepartidorSuggestions(false)
      return
    }

    // Check for similar matches (using Levenshtein distance and substring matching)
    const similarMatches = distributors.filter(d => {
      const existingCalle = d.calle.toLowerCase().trim()
      const newCalle = newDistributor.calle.toLowerCase().trim()
      
      // Check if one contains the other
      const containsMatch = existingCalle.includes(newCalle) || newCalle.includes(existingCalle)
      
      // Check Levenshtein distance for similar strings
      const distance = calculateLevenshteinDistance(existingCalle, newCalle)
      const maxLength = Math.max(existingCalle.length, newCalle.length)
      const similarity = 1 - (distance / maxLength)
      
      return containsMatch || similarity > 0.7 // 70% similarity threshold
    })

    if (similarMatches.length > 0) {
      const similarStreets = similarMatches.map(d => `"${d.calle}" (${d.repartidor})`).join('\n')
      const shouldContinue = confirm(
        `Se encontraron calles similares:\n\n${similarStreets}\n\n` +
        `¿Está seguro de que desea agregar "${newDistributor.calle}" como una nueva entrada?`
      )

      if (!shouldContinue) {
        setShowCalleSuggestions(false)
        setShowRepartidorSuggestions(false)
        return
      }
    }

    // Proceed with adding new distributor
    const { error } = await supabase
      .from('distributors')
      .insert([newDistributor])

    if (error) {
      alert('Error al agregar: ' + error.message)
    } else {
      setNewDistributor({ calle: '', repartidor: '' })
      fetchDistributors()
      alert('Repartidor agregado exitosamente')
    }
    setShowCalleSuggestions(false)
    setShowRepartidorSuggestions(false)
  }

  // Helper function to calculate Levenshtein distance
  const calculateLevenshteinDistance = (str1: string, str2: string): number => {
    const matrix = []

    // Create matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  const handleEdit = (distributor: Distributor) => {
    setEditingId(distributor.id)
    setEditingData({ calle: distributor.calle, repartidor: distributor.repartidor })
  }

  const handleUpdate = async (id: number) => {
    const { error } = await supabase
      .from('distributors')
      .update(editingData)
      .eq('id', id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      setEditingId(null)
      fetchDistributors()
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este registro?')) return

    const { error } = await supabase
      .from('distributors')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      fetchDistributors()
    }
  }

  const handleSelectDistributor = (id: number) => {
    setSelectedDistributors(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedDistributors.length === filteredDistributors.length) {
      setSelectedDistributors([])
    } else {
      setSelectedDistributors(filteredDistributors.map(d => d.id))
    }
  }

  const handleBulkUpdate = async () => {
    if (!bulkRepartidor || selectedDistributors.length === 0) return

    try {
      const { error } = await supabase
        .from('distributors')
        .update({ repartidor: bulkRepartidor })
        .in('id', selectedDistributors)

      if (error) throw error
      
      setSelectedDistributors([])
      setBulkRepartidor('')
      fetchDistributors()
      alert(`${selectedDistributors.length} repartidores actualizados`)
    } catch (error: any) {
      alert('Error al actualizar: ' + error.message)
    }
  }

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new()
    
    // Prepare data for export
    const exportData = [
      ['REPARTIDORES - SISTEMA DE GESTIÓN'],
      [''],
      [`Exportado: ${new Date().toLocaleDateString()}`],
      [`Total de registros: ${distributors.length}`],
      [''],
      ['Calle', 'Repartidor', 'Fecha Creación', 'Última Actualización']
    ]

    // Add distributor data
    distributors.forEach(distributor => {
      exportData.push([
        distributor.calle,
        distributor.repartidor,
        new Date(distributor.created_at).toLocaleDateString(),
        new Date(distributor.updated_at).toLocaleDateString()
      ])
    })

    const worksheet = XLSX.utils.aoa_to_sheet(exportData) as XLSX.WorkSheet
    
    // Style the worksheet
    worksheet['!cols'] = [
      { width: 35 }, // Calle
      { width: 20 }, // Repartidor
      { width: 15 }, // Fecha Creación
      { width: 20 }  // Última Actualización
    ]

    // Style title row
    if (worksheet['A1']) {
      (worksheet['A1'] as any).s = {
        font: { bold: true, sz: 16, color: { rgb: "1F4E79" } },
        alignment: { horizontal: 'center' },
        fill: { fgColor: { rgb: "D9E2F3" } }
      }
    }

    // Style header row
    const headerRow = 6
    ;['A', 'B', 'C', 'D'].forEach(col => {
      const cellRef = `${col}${headerRow}`
      if (worksheet[cellRef]) {
        (worksheet[cellRef] as any).s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E8F4FD" } },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        }
      }
    })

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Repartidores')
    
    const filename = `Repartidores_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(workbook, filename)
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const worksheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[worksheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        processImportData(jsonData as any[][])
      } catch (error) {
        alert('Error al leer el archivo. Asegúrese de que sea un archivo Excel válido.')
        console.error('Import error:', error)
      }
    }
    reader.readAsArrayBuffer(file)
    
    // Reset input
    event.target.value = ''
  }

  const processImportData = (data: any[][]) => {
    // Find the header row (should contain "Calle" and "Repartidor")
    let headerRowIndex = -1
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (row.some(cell => 
        typeof cell === 'string' && 
        (cell.toLowerCase().includes('calle') || cell.toLowerCase().includes('repartidor'))
      )) {
        headerRowIndex = i
        break
      }
    }

    if (headerRowIndex === -1) {
      alert('No se encontraron las columnas requeridas (Calle, Repartidor) en el archivo.')
      return
    }

    const headerRow = data[headerRowIndex]
    const calleIndex = headerRow.findIndex((cell: any) => 
      typeof cell === 'string' && cell.toLowerCase().includes('calle')
    )
    const repartidorIndex = headerRow.findIndex((cell: any) => 
      typeof cell === 'string' && cell.toLowerCase().includes('repartidor')
    )

    if (calleIndex === -1 || repartidorIndex === -1) {
      alert('No se encontraron las columnas "Calle" y "Repartidor" en el archivo.')
      return
    }

    // Process data rows
    const importData: { calle: string; repartidor: string }[] = []
    const errors: string[] = []
    const duplicates: string[] = []
    const similar: string[] = []

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      const calle = row[calleIndex]?.toString().trim()
      const repartidor = row[repartidorIndex]?.toString().trim()

      if (!calle || !repartidor) {
        errors.push(`Fila ${i + 1}: Faltan datos requeridos`)
        continue
      }

      // Check for duplicates in existing distributors
      const exactMatch = distributors.find(d => 
        d.calle.toLowerCase().trim() === calle.toLowerCase().trim()
      )

      if (exactMatch) {
        duplicates.push(`Fila ${i + 1}: "${calle}" ya existe (actual: ${exactMatch.repartidor}, nuevo: ${repartidor})`)
      }

      // Check for similar matches
      const similarMatches = distributors.filter(d => {
        const existingCalle = d.calle.toLowerCase().trim()
        const newCalle = calle.toLowerCase().trim()
        
        const containsMatch = existingCalle.includes(newCalle) || newCalle.includes(existingCalle)
        const distance = calculateLevenshteinDistance(existingCalle, newCalle)
        const maxLength = Math.max(existingCalle.length, newCalle.length)
        const similarity = 1 - (distance / maxLength)
        
        return containsMatch || similarity > 0.7
      })

      if (similarMatches.length > 0 && !exactMatch) {
        const similarStreets = similarMatches.map(d => d.calle).join(', ')
        similar.push(`Fila ${i + 1}: "${calle}" es similar a: ${similarStreets}`)
      }

      importData.push({ calle, repartidor })
    }

    // Show warnings and get user confirmation
    let warningMessage = ''
    
    if (errors.length > 0) {
      warningMessage += `ERRORES (${errors.length}):\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}\n\n`
    }
    
    if (duplicates.length > 0) {
      warningMessage += `DUPLICADOS (${duplicates.length}):\n${duplicates.slice(0, 3).join('\n')}${duplicates.length > 3 ? '\n...' : ''}\n\n`
    }
    
    if (similar.length > 0) {
      warningMessage += `SIMILARES (${similar.length}):\n${similar.slice(0, 3).join('\n')}${similar.length > 3 ? '\n...' : ''}\n\n`
    }

    if (warningMessage) {
      const options = []
      if (duplicates.length > 0) options.push('Los duplicados SOBRESCRIBIRÁN los existentes')
      if (similar.length > 0) options.push('Los similares se agregarán como nuevas entradas')
      
      warningMessage += options.join('\n') + '\n\n¿Desea continuar con la importación?'
      
      if (!confirm(warningMessage)) return
    }

    if (importData.length === 0) {
      alert('No se encontraron datos válidos para importar.')
      return
    }

    confirmImport(importData, duplicates.length > 0)
  }

  const confirmImport = (importData: { calle: string; repartidor: string }[], hasDuplicates: boolean) => {
    const message = `Se van a ${hasDuplicates ? 'importar/actualizar' : 'importar'} ${importData.length} registros.\n\n` +
      'Vista previa de los primeros 5 registros:\n' +
      importData.slice(0, 5).map((item, index) => 
        `${index + 1}. ${item.calle} - ${item.repartidor}`
      ).join('\n') +
      (importData.length > 5 ? '\n...' : '') +
      '\n\n¿Desea continuar?'

    if (confirm(message)) {
      executeImport(importData)
    }
  }

  const executeImport = async (importData: { calle: string; repartidor: string }[]) => {
    try {
      setLoading(true)
      let insertCount = 0
      let updateCount = 0

      for (const item of importData) {
        // Check if exists
        const existing = distributors.find(d => 
          d.calle.toLowerCase().trim() === item.calle.toLowerCase().trim()
        )

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('distributors')
            .update({ repartidor: item.repartidor })
            .eq('id', existing.id)

          if (error) throw error
          updateCount++
        } else {
          // Insert new
          const { error } = await supabase
            .from('distributors')
            .insert([item])

          if (error) throw error
          insertCount++
        }
      }

      alert(
        `¡Importación exitosa!\n` +
        `Registros agregados: ${insertCount}\n` +
        `Registros actualizados: ${updateCount}\n` +
        `Total procesados: ${insertCount + updateCount}`
      )
      fetchDistributors()
    } catch (error: any) {
      console.error('Import error:', error)
      alert('Error durante la importación: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      ['PLANTILLA PARA IMPORTAR REPARTIDORES'],
      [''],
      ['Instrucciones:'],
      ['1. Complete las columnas "Calle" y "Repartidor"'],
      ['2. No modifique los nombres de las columnas'],
      ['3. Guarde el archivo y úselo para importar'],
      [''],
      ['Calle', 'Repartidor'],
      ['Ejemplo: Av. San Martín 123', 'Juan Pérez'],
      ['Ejemplo: B° Centro', 'María García'],
      ['', ''] // Filas vacías para completar
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(templateData)
    
    // Style the template
    worksheet['!cols'] = [{ width: 35 }, { width: 20 }]
    
    // Style title
    if (worksheet['A1']) {
      worksheet['A1'].s = {
        font: { bold: true, sz: 14 },
        fill: { fgColor: { rgb: "D9E2F3" } }
      }
    }

    // Style headers
    ['A8', 'B8'].forEach(cell => {
      if (worksheet[cell]) {
        worksheet[cell].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E8F4FD" } },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        }
      }
    })

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla')
    XLSX.writeFile(workbook, 'Plantilla_Repartidores.xlsx')
  }

  if (loading) {
    return <div className="loading">Verificando permisos...</div>
  }

  if (!isAdmin) {
    return (
      <div className="access-denied">
        <h2><span className="icon">🔒</span> Acceso Denegado</h2>
        <p>Solo los administradores pueden gestionar repartidores.</p>
      </div>
    )
  }

  return (
    <div className="distributor-manager">
      <h2><span className="icon">👥</span> Gestión de Repartidores</h2>
      
      {/* Excel Import/Export Section */}
      <div className="excel-section">
        <h3><span className="icon">📊</span> Importar/Exportar Excel</h3>
        <div className="excel-controls">
          <button 
            className="btn btn-success"
            onClick={exportToExcel}
            disabled={distributors.length === 0}
          >
            <span className="icon">📥</span> Exportar a Excel
          </button>
          
          <button 
            className="btn btn-info"
            onClick={downloadTemplate}
          >
            <span className="icon">📋</span> Descargar Plantilla
          </button>
          
          <div className="import-controls">
            <input
              type="file"
              id="excel-import"
              accept=".xlsx,.xls"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
            <button 
              className="btn btn-primary"
              onClick={() => document.getElementById('excel-import')?.click()}
            >
              <span className="icon">📤</span> Importar desde Excel
            </button>
          </div>
        </div>
        
        <div className="excel-info">
          <div 
            className="info-header"
            onClick={() => setShowImportInfo(!showImportInfo)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>{showImportInfo ? '📄' : '📋'}</span>
            <strong>Información sobre importación</strong>
            <span style={{ marginLeft: 'auto' }}>{showImportInfo ? '▼' : '▶'}</span>
          </div>
          
          {showImportInfo && (
            <ul style={{ marginTop: '0.5rem' }}>
              <li>El archivo debe contener las columnas "Calle" y "Repartidor"</li>
              <li>Se pueden agregar múltiples registros a la vez</li>
              <li>Los registros duplicados serán agregados como nuevas entradas</li>
              <li>Descarga la plantilla para ver el formato correcto</li>
            </ul>
          )}
        </div>
      </div>

      <div className="add-form">
        <h3><span className="icon">+</span> Agregar Nuevo</h3>
        <form onSubmit={handleAdd} className="add-form-fields">
          <div className="autocomplete-container">
            <input
              type="text"
              placeholder="📍 Calle"
              value={newDistributor.calle}
              onChange={(e) => handleCalleChange(e.target.value)}
              onFocus={() => newDistributor.calle && setShowCalleSuggestions(true)}
              onBlur={() => setTimeout(() => setShowCalleSuggestions(false), 200)}
              required
            />
            {showCalleSuggestions && callesSuggestions.length > 0 && (
              <div className="autocomplete-dropdown">
                {callesSuggestions.slice(0, 5).map((calle, index) => (
                  <div 
                    key={index} 
                    className="autocomplete-item"
                    onClick={() => handleCalleSelect(calle)}
                  >
                    {calle}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="autocomplete-container">
            <input
              type="text"
              placeholder="👤 Repartidor"
              value={newDistributor.repartidor}
              onChange={(e) => handleRepartidorChange(e.target.value)}
              onFocus={() => newDistributor.repartidor && setShowRepartidorSuggestions(true)}
              onBlur={() => setTimeout(() => setShowRepartidorSuggestions(false), 200)}
              required
            />
            {showRepartidorSuggestions && repartidoresSuggestions.length > 0 && (
              <div className="autocomplete-dropdown">
                {repartidoresSuggestions.slice(0, 5).map((repartidor, index) => (
                  <div 
                    key={index} 
                    className="autocomplete-item"
                    onClick={() => handleRepartidorSelect(repartidor)}
                  >
                    {repartidor}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <button type="submit"><span className="icon">+</span> Agregar</button>
        </form>
      </div>

      <div className="search-section">
        <h3><span className="icon">🔍</span> Buscar Repartidores</h3>
        <input
          type="text"
          placeholder="Buscar por calle o repartidor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        {searchTerm && (
          <p className="search-results">
            Mostrando {filteredDistributors.length} de {distributors.length} resultados
          </p>
        )}
      </div>

      {selectedDistributors.length > 0 && (
        <div className="bulk-edit-section">
          <h3>Edición en Lote ({selectedDistributors.length} seleccionados)</h3>
          <div className="bulk-edit-controls">
            <input
              type="text"
              placeholder="Nuevo repartidor"
              value={bulkRepartidor}
              onChange={(e) => setBulkRepartidor(e.target.value)}
            />
            <button onClick={handleBulkUpdate} className="btn-save">
              <span className="icon">✓</span> Actualizar Seleccionados
            </button>
            <button onClick={() => setSelectedDistributors([])} className="btn-cancel">
              <span className="icon">×</span> Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="distributors-table">
        <h3>Lista de Repartidores</h3>
        <div className="table-controls">
          <button onClick={handleSelectAll} className="btn-select-all">
            {selectedDistributors.length === filteredDistributors.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Seleccionar</th>
              <th><span className="icon">📍</span> Calle</th>
              <th><span className="icon">👤</span> Repartidor</th>
              <th><span className="icon">⚙</span> Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredDistributors.map(distributor => (
              <tr key={distributor.id} className={selectedDistributors.includes(distributor.id) ? 'selected' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedDistributors.includes(distributor.id)}
                    onChange={() => handleSelectDistributor(distributor.id)}
                  />
                </td>
                <td>
                  {editingId === distributor.id ? (
                    <input
                      type="text"
                      value={editingData.calle}
                      onChange={(e) => setEditingData({...editingData, calle: e.target.value})}
                    />
                  ) : (
                    distributor.calle
                  )}
                </td>
                <td>
                  {editingId === distributor.id ? (
                    <input
                      type="text"
                      value={editingData.repartidor}
                      onChange={(e) => setEditingData({...editingData, repartidor: e.target.value})}
                    />
                  ) : (
                    distributor.repartidor
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    {editingId === distributor.id ? (
                      <>
                        <button onClick={() => handleUpdate(distributor.id)} className="btn-save">
                          <span className="icon">✓</span> Guardar
                        </button>
                        <button onClick={() => setEditingId(null)} className="btn-cancel">
                          <span className="icon">×</span> Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(distributor)} className="btn-edit">
                          <span className="icon">✎</span> Editar
                        </button>
                        <button onClick={() => handleDelete(distributor.id)} className="btn-delete">
                          <span className="icon">🗑</span> Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}