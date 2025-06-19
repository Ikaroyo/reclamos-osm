import { useState, useEffect } from 'react'
import { supabase, Complaint, Distributor, checkIsAdmin } from '../lib/supabase'
import * as XLSX from 'xlsx'

export default function ComplaintsList() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([])
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [filteredStreets, setFilteredStreets] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingData, setEditingData] = useState<Complaint | null>(null)
  const [editingCuenta1, setEditingCuenta1] = useState('')
  const [editingCuenta2, setEditingCuenta2] = useState('')
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showImportInfo, setShowImportInfo] = useState(false)
  const [selectedComplaints, setSelectedComplaints] = useState<number[]>([])
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [, setLoading] = useState(false)
  const [bulkEditData, setBulkEditData] = useState({
    repartidor: '',
    entregar: false,
    emitido: false,
    enviar_por_mail: false
  })

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  useEffect(() => {
    fetchComplaints()
    fetchDistributors()
    checkAdminStatus()
  }, [])

  

  useEffect(() => {
    filterComplaints()
  }, [complaints, searchTerm])

  const checkAdminStatus = async () => {
    const adminStatus = await checkIsAdmin()
    setIsAdmin(adminStatus)
  }

  const fetchComplaints = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    let query = supabase.from('complaints').select('*')
    
    // If not admin, only show user's own complaints
    if (!isAdmin) {
      query = query.eq('user_id', user?.id)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching complaints:', error)
    } else {
      setComplaints(data || [])
    }
  }

  const fetchDistributors = async () => {
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
    
    if (error) {
      console.error('Error fetching distributors:', error)
    } else {
      setDistributors(data || [])
    }
  }

  const filterComplaints = () => {
    let filtered = complaints

    if (searchTerm) {
      filtered = filtered.filter(complaint =>
        complaint.calle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        complaint.cuenta.includes(searchTerm) ||
        complaint.repartidor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        complaint.numero.includes(searchTerm) ||
        (complaint.observaciones && complaint.observaciones.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    setFilteredComplaints(filtered)
  }

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new()
    
    // Prepare data for export
    const exportData = [
      ['LISTADO DE RECLAMOS'],
      [''],
      [`Exportado: ${new Date().toLocaleDateString()}`],
      [`Total de registros: ${filteredComplaints.length}`],
      [''],
      ['ID', 'Mes', 'Año', 'Cuenta', 'Calle', 'Número', 'Repartidor', 'Observaciones', 'Entregar', 'Emitido', 'Enviar por Mail', 'Email', 'Teléfono', 'Tomado por', 'Fecha Creación']
    ]

    // Add complaint data
    filteredComplaints.forEach(complaint => {
      exportData.push([
        complaint.id.toString(),
        complaint.mes.toString(),
        complaint.año.toString(),
        complaint.cuenta,
        complaint.calle,
        complaint.numero,
        complaint.repartidor,
        complaint.observaciones || '',
        complaint.entregar ? 'Sí' : 'No',
        complaint.emitido ? 'Sí' : 'No',
        complaint.enviar_por_mail ? 'Sí' : 'No',
        complaint.mail || '',
        complaint.telefono || '',
        complaint.tomado_por || '',
        new Date(complaint.created_at).toLocaleDateString()
      ])
    })

    const worksheet = XLSX.utils.aoa_to_sheet(exportData)
    
    // Style the worksheet
    worksheet['!cols'] = [
      { width: 8 },  // ID
      { width: 8 },  // Mes
      { width: 8 },  // Año
      { width: 15 }, // Cuenta
      { width: 25 }, // Calle
      { width: 10 }, // Número
      { width: 15 }, // Repartidor
      { width: 40 }, // Observaciones
      { width: 10 }, // Entregar
      { width: 10 }, // Emitido
      { width: 15 }, // Enviar por Mail
      { width: 25 }, // Email
      { width: 15 }, // Teléfono
      { width: 15 }, // Tomado por
      { width: 15 }  // Fecha Creación
    ]

    // Style title row
    if (worksheet['A1']) {
      worksheet['A1'].s = {
        font: { bold: true, sz: 16, color: { rgb: "1F4E79" } },
        alignment: { horizontal: 'center' },
        fill: { fgColor: { rgb: "D9E2F3" } }
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reclamos')
    
    const filename = `Reclamos_${new Date().toISOString().split('T')[0]}.xlsx`
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

  const formatAccountNumber = (account: string): string => {
    if (!account) return account
    
    const cleanAccount = account.toString().trim()
    
    // If it already has a slash, return as is
    if (cleanAccount.includes('/')) {
      return cleanAccount
    }
    
    // If it's a number without slash, format it
    if (/^\d+$/.test(cleanAccount)) {
      // Pad with zeros to make it 7 digits before the slash
      const paddedNumber = cleanAccount.padStart(7, '0')
      return `${paddedNumber}/000`
    }
    
    // If it's not a pure number, return as is
    return cleanAccount
  }

  const processImportData = (data: any[][]) => {
    // Find the header row
    let headerRowIndex = -1
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (row.some(cell => 
        typeof cell === 'string' && 
        (cell.toLowerCase().includes('cuenta') || cell.toLowerCase().includes('calle') || cell.toLowerCase().includes('repartidor'))
      )) {
        headerRowIndex = i
        break
      }
    }

    if (headerRowIndex === -1) {
      alert('No se encontraron las columnas requeridas en el archivo.')
      return
    }

    const headerRow = data[headerRowIndex]
    
    // Find column indices
    const columnMapping: Record<
      'mes' | 'año' | 'cuenta' | 'calle' | 'numero' | 'repartidor' | 'observaciones' | 'entregar' | 'emitido' | 'enviar_por_mail' | 'mail' | 'telefono' | 'tomado_por',
      number
    > = {
      mes: findColumnIndex(headerRow, ['mes']),
      año: findColumnIndex(headerRow, ['año', 'ano', 'year']),
      cuenta: findColumnIndex(headerRow, ['cuenta', 'account']),
      calle: findColumnIndex(headerRow, ['calle', 'street']),
      numero: findColumnIndex(headerRow, ['numero', 'número', 'number']),
      repartidor: findColumnIndex(headerRow, ['repartidor', 'distributor']),
      observaciones: findColumnIndex(headerRow, ['observaciones', 'observacion', 'comments']),
      entregar: findColumnIndex(headerRow, ['entregar', 'deliver']),
      emitido: findColumnIndex(headerRow, ['emitido', 'issued']),
      enviar_por_mail: findColumnIndex(headerRow, ['enviar_por_mail', 'send_by_mail', 'email']),
      mail: findColumnIndex(headerRow, ['mail', 'email']),
      telefono: findColumnIndex(headerRow, ['telefono', 'teléfono', 'phone']),
      tomado_por: findColumnIndex(headerRow, ['tomado_por', 'taken_by'])
    }

    // Validate required columns
    const requiredColumns: (keyof typeof columnMapping)[] = ['mes', 'año', 'cuenta', 'calle', 'numero', 'repartidor']
    const missingColumns = requiredColumns.filter(col => columnMapping[col] === -1)
    
    if (missingColumns.length > 0) {
      alert(`Faltan las siguientes columnas requeridas: ${missingColumns.join(', ')}`)
      return
    }

    // Process data rows
    const importData: any[] = []
    const errors: string[] = []

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      try {
        // Format the account number
        const rawAccount = row[columnMapping.cuenta]?.toString().trim() || ''
        const formattedAccount = formatAccountNumber(rawAccount)

        const complaint = {
          mes: parseInt(row[columnMapping.mes]) || 0,
          año: parseInt(row[columnMapping.año]) || new Date().getFullYear(),
          cuenta: formattedAccount,
          calle: row[columnMapping.calle]?.toString().trim() || '',
          numero: row[columnMapping.numero]?.toString().trim() || '',
          repartidor: row[columnMapping.repartidor]?.toString().trim() || '',
          observaciones: row[columnMapping.observaciones]?.toString().trim() || null,
          entregar: parseBooleanValue(row[columnMapping.entregar]),
          emitido: parseBooleanValue(row[columnMapping.emitido]),
          enviar_por_mail: parseBooleanValue(row[columnMapping.enviar_por_mail]),
          mail: row[columnMapping.mail]?.toString().trim() || null,
          telefono: row[columnMapping.telefono]?.toString().trim() || null,
          tomado_por: row[columnMapping.tomado_por]?.toString().trim() || null
        }

        // Validate required fields
        if (!complaint.cuenta || !complaint.calle || !complaint.numero || !complaint.repartidor) {
          errors.push(`Fila ${i + 1}: Faltan datos requeridos`)
          continue
        }

        if (complaint.mes < 1 || complaint.mes > 12) {
          errors.push(`Fila ${i + 1}: Mes inválido (${complaint.mes})`)
          continue
        }

        importData.push(complaint)
      } catch (error) {
        errors.push(`Fila ${i + 1}: Error procesando datos`)
      }
    }

    if (errors.length > 0) {
      const continueImport = confirm(
        `Se encontraron ${errors.length} errores:\n${errors.slice(0, 5).join('\n')}${
          errors.length > 5 ? '\n...' : ''
        }\n\n¿Desea continuar con la importación de los registros válidos?`
      )
      if (!continueImport) return
    }

    if (importData.length === 0) {
      alert('No se encontraron datos válidos para importar.')
      return
    }

    confirmImport(importData)
  }

  const findColumnIndex = (headerRow: any[], searchTerms: string[]): number => {
    for (const term of searchTerms) {
      const index = headerRow.findIndex(cell => 
        typeof cell === 'string' && cell.toLowerCase().includes(term.toLowerCase())
      )
      if (index !== -1) return index
    }
    return -1
  }

  const parseBooleanValue = (value: any): boolean => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim()
      return lower === 'sí' || lower === 'si' || lower === 'yes' || lower === 'true' || lower === '1'
    }
    if (typeof value === 'number') return value === 1
    return false
  }

  const confirmImport = (importData: any[]) => {
    const message = `Se van a importar ${importData.length} reclamos.\n\n` +
      'Vista previa de los primeros 3 registros:\n' +
      importData.slice(0, 3).map((item, index) => 
        `${index + 1}. ${item.cuenta} - ${item.repartidor} ${item.numero} (${item.repartidor})`
      ).join('\n') +
      (importData.length > 3 ? '\n...' : '') +
      '\n\n¿Desea continuar?'

    if (confirm(message)) {
      executeImport(importData)
    }
  }

  const executeImport = async (importData: any[]) => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      
      // Add user_id to each complaint
      const complaintsWithUser = importData.map(complaint => ({
        ...complaint,
        user_id: user?.id
      }))
      
      const { error } = await supabase
        .from('complaints')
        .insert(complaintsWithUser)

      if (error) throw error

      alert(`¡Importación exitosa! Se han agregado ${importData.length} reclamos.`)
      fetchComplaints()
    } catch (error: any) {
      console.error('Import error:', error)
      alert('Error durante la importación: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      ['PLANTILLA PARA IMPORTAR RECLAMOS'],
      [''],
      ['Instrucciones:'],
      ['1. Complete todas las columnas requeridas'],
      ['2. Mes debe ser un número del 1 al 12'],
      ['3. Para campos booleanos use: Sí/No o True/False'],
      ['4. Las cuentas numéricas se formatearán automáticamente (ej: 12345 → 0012345/000)'],
      ['5. No modifique los nombres de las columnas'],
      [''],
      ['Mes', 'Año', 'Cuenta', 'Calle', 'Número', 'Repartidor', 'Observaciones', 'Entregar', 'Emitido', 'Enviar por Mail', 'Mail', 'Teléfono', 'Tomado por'],
      [1, 2024, '12345', 'Av. San Martín', '123', 'Juan Pérez', 'Ejemplo de observación', 'No', 'No', 'Sí', 'ejemplo@email.com', '123456789', 'Admin'],
      [2, 2024, '1234567/000', 'B° Centro', '456', 'María García', '', 'Sí', 'No', 'No', '', '', ''],
      [3, 2024, '987', 'Calle Ejemplo', '789', 'Pedro López', 'Se formateará a 0000987/000', 'No', 'Sí', 'No', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''] // Fila vacía para completar
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(templateData)
    
    // Style the template
    worksheet['!cols'] = [
      { width: 8 }, { width: 8 }, { width: 15 }, { width: 25 }, { width: 10 }, 
      { width: 15 }, { width: 40 }, { width: 10 }, { width: 10 }, { width: 15 }, 
      { width: 25 }, { width: 15 }, { width: 15 }
    ]
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla')
    XLSX.writeFile(workbook, 'Plantilla_Reclamos.xlsx')
  }

  const handleEdit = (complaint: Complaint) => {
    setEditingId(complaint.id)
    setEditingData({ ...complaint })
    
    // Split cuenta for editing
    const cuentaParts = complaint.cuenta.split('/')
    setEditingCuenta1(cuentaParts[0] || '')
    setEditingCuenta2(cuentaParts[1] || '')
  }

  const formatCuentaPart = (value: string, isFirst: boolean) => {
    const digits = value.replace(/\D/g, '')
    return isFirst ? digits.slice(0, 7) : digits.slice(0, 3)
  }

  const handleCuenta1Blur = () => {
    if (editingCuenta1) {
      const padded = editingCuenta1.padStart(7, '0')
      setEditingCuenta1(padded)
    }
  }

  const handleCuenta2Blur = () => {
    if (editingCuenta2) {
      const padded = editingCuenta2.padStart(3, '0')
      setEditingCuenta2(padded)
    }
  }

  const validateCuentaEdit = () => {
    return editingCuenta1.length === 7 && editingCuenta2.length === 3
  }

  const handleUpdate = async () => {
    if (!editingData) return

    if (!validateCuentaEdit()) {
      alert('Formato de cuenta inválido. Complete ambos campos')
      return
    }

    if (editingData.enviar_por_mail && editingData.mail && !validateEmail(editingData.mail)) {
      alert('Email inválido')
      return
    }

    const { error } = await supabase
      .from('complaints')
      .update({
        mes: editingData.mes,
        año: editingData.año,
        cuenta: `${editingCuenta1}/${editingCuenta2}`,
        calle: editingData.calle,
        numero: editingData.numero,
        repartidor: editingData.repartidor,
        observaciones: editingData.observaciones,
        entregar: editingData.entregar,
        emitido: editingData.emitido,
        enviar_por_mail: editingData.enviar_por_mail,
        mail: editingData.mail,
        telefono: editingData.telefono
      })
      .eq('id', editingData.id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
    } else {
      setEditingId(null)
      setEditingData(null)
      setShowStreetSuggestions(false)
      fetchComplaints()
    }
  }

  const handleCalleChange = (value: string) => {
    if (!editingData) return
    
    setEditingData({ ...editingData, calle: value })
    
    if (value.length > 0) {
      const filtered = distributors
        .filter(d => d.calle.toLowerCase().includes(value.toLowerCase()))
        .map(d => d.calle)
      setFilteredStreets([...new Set(filtered)])
      setShowStreetSuggestions(true)
    } else {
      setFilteredStreets([])
      setShowStreetSuggestions(false)
    }
  }

  const handleCalleSelect = (calle: string) => {
    if (!editingData) return
    
    setEditingData({ ...editingData, calle })
    setShowStreetSuggestions(false)
    
    // Auto-fill repartidor
    const distributor = distributors.find(d => d.calle === calle)
    if (distributor) {
      setEditingData(prev => prev ? { ...prev, calle, repartidor: distributor.repartidor } : null)
    }
  }

  const validateEmail = (email: string) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(email)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este reclamo?')) return

    const { error } = await supabase
      .from('complaints')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      fetchComplaints()
    }
  }

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i)

  const formatTelefono = (value: string) => {
    // Remove all non-numeric characters including dashes
    return value.replace(/\D/g, '')
  }

  const handleSelectComplaint = (id: number) => {
    setSelectedComplaints(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedComplaints.length === filteredComplaints.length) {
      setSelectedComplaints([])
    } else {
      setSelectedComplaints(filteredComplaints.map(c => c.id))
    }
  }

  const handleBulkUpdate = async () => {
    if (selectedComplaints.length === 0) return

    const updateData: any = {}
    if (bulkEditData.repartidor) updateData.repartidor = bulkEditData.repartidor
    if (bulkEditData.entregar !== undefined) updateData.entregar = bulkEditData.entregar
    if (bulkEditData.emitido !== undefined) updateData.emitido = bulkEditData.emitido
    if (bulkEditData.enviar_por_mail !== undefined) updateData.enviar_por_mail = bulkEditData.enviar_por_mail

    if (Object.keys(updateData).length === 0) {
      alert('Por favor seleccione al menos un campo para actualizar')
      return
    }

    if (!confirm(`¿Está seguro de que desea actualizar ${selectedComplaints.length} reclamos?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('complaints')
        .update(updateData)
        .in('id', selectedComplaints)

      if (error) throw error
      
      alert(`${selectedComplaints.length} reclamos actualizados exitosamente`)
      setSelectedComplaints([])
      setBulkEditData({
        repartidor: '',
        entregar: false,
        emitido: false,
        enviar_por_mail: false
      })
      setShowBulkEdit(false)
      fetchComplaints()
    } catch (error: any) {
      alert('Error al actualizar reclamos: ' + error.message)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedComplaints.length === 0) return

    if (!confirm(`¿Está seguro de que desea ELIMINAR ${selectedComplaints.length} reclamos?\n\nEsta acción no se puede deshacer.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('complaints')
        .delete()
        .in('id', selectedComplaints)

      if (error) throw error
      
      alert(`${selectedComplaints.length} reclamos eliminados exitosamente`)
      setSelectedComplaints([])
      setShowBulkEdit(false)
      fetchComplaints()
    } catch (error: any) {
      alert('Error al eliminar reclamos: ' + error.message)
    }
  }

  return (
    <div className="complaints-list">
      <h2><span className="icon">📋</span> Lista de Reclamos</h2>
      
      {/* Excel Import/Export Section */}
      <div className="excel-section">
        <h3><span className="icon">📊</span> Importar/Exportar Excel</h3>
        <div className="excel-controls">
          <button 
            className="btn btn-success"
            onClick={exportToExcel}
            disabled={filteredComplaints.length === 0}
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
              id="complaints-excel-import"
              accept=".xlsx,.xls"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
            <button 
              className="btn btn-primary"
              onClick={() => document.getElementById('complaints-excel-import')?.click()}
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
              <li>Campos requeridos: Mes, Año, Cuenta, Calle, Número, Repartidor</li>
              <li>El mes debe ser un número del 1 al 12</li>
              <li>Para campos booleanos use: Sí/No, True/False, o 1/0</li>
              <li><strong>Formateo automático de cuentas:</strong> Los números sin "/" se formatearán automáticamente</li>
              <li>Ejemplo: 12345 → 0012345/000, 987 → 0000987/000</li>
              <li>Descarga la plantilla para ver el formato correcto</li>
            </ul>
          )}
        </div>
      </div>

      {/* Bulk Edit Section */}
      {selectedComplaints.length > 0 && (
        <div className="bulk-edit-section">
          <h3>
            <span className="icon">✏️</span> 
            Edición en Lote ({selectedComplaints.length} seleccionados)
          </h3>
          
          {!showBulkEdit && (
            <button 
              onClick={() => setShowBulkEdit(true)}
              className="btn btn-primary"
            >
              <span className="icon">✏️</span> Editar Seleccionados
            </button>
          )}

          {showBulkEdit && (
            <div className="bulk-edit-controls">
              <div className="bulk-edit-fields">
                <div>
                  <label>Repartidor:</label>
                  <input
                    type="text"
                    value={bulkEditData.repartidor}
                    onChange={(e) => setBulkEditData({...bulkEditData, repartidor: e.target.value})}
                    placeholder="Nuevo repartidor (opcional)"
                  />
                </div>
                
                <div className="checkbox-group-small">
                  <label>
                    <input
                      type="checkbox"
                      checked={bulkEditData.entregar}
                      onChange={(e) => setBulkEditData({...bulkEditData, entregar: e.target.checked})}
                    />
                    <span className="icon">📦</span> Marcar como "Entregar"
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={bulkEditData.emitido}
                      onChange={(e) => setBulkEditData({...bulkEditData, emitido: e.target.checked})}
                    />
                    <span className="icon">✓</span> Marcar como "Emitido"
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={bulkEditData.enviar_por_mail}
                      onChange={(e) => setBulkEditData({...bulkEditData, enviar_por_mail: e.target.checked})}
                    />
                    <span className="icon">@</span> Marcar como "Enviar por Email"
                  </label>
                </div>
              </div>

              <div className="bulk-edit-actions">
                <button onClick={handleBulkUpdate} className="btn-save">
                  <span className="icon">✓</span> Aplicar Cambios
                </button>
                <button onClick={handleBulkDelete} className="btn-delete">
                  <span className="icon">🗑️</span> Eliminar Seleccionados
                </button>
                <button onClick={() => setShowBulkEdit(false)} className="btn-cancel">
                  <span className="icon">×</span> Cancelar
                </button>
                <button 
                  onClick={() => setSelectedComplaints([])} 
                  className="btn-cancel"
                >
                  <span className="icon">⊗</span> Deseleccionar Todo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder="🔍 Buscar por cuenta, calle, repartidor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        {/*
        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="delivered">Entregados</option>
            <option value="issued">Emitidos</option>
          </select>
        </div>
        */}
      </div>

      {/* Results info */}
      {searchTerm && (
        <p className="search-results">
          Mostrando {filteredComplaints.length} de {complaints.length} reclamos
        </p>
      )}

      {/* Complaints table */}
      <div className="complaints-table">
        <div className="table-controls">
          <button onClick={handleSelectAll} className="btn-select-all">
            <span className="icon">{selectedComplaints.length === filteredComplaints.length ? '☐' : '☑'}</span>
            {selectedComplaints.length === filteredComplaints.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
          </button>
          {selectedComplaints.length > 0 && (
            <span className="selection-info">
              {selectedComplaints.length} reclamo(s) seleccionado(s)
            </span>
          )}
        </div>

        <table>
          <thead>
            <tr>
              <th><span className="icon">☑</span> Sel.</th>
              <th><span className="icon">📅</span> Fecha</th>
              <th><span className="icon">#</span> Cuenta</th>
              <th><span className="icon">📍</span> Calle</th>
              <th><span className="icon">🏠</span> Número</th>
              <th><span className="icon">👤</span> Repartidor</th>
              <th><span className="icon">⚙</span> Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredComplaints.map(complaint => (
              <>
                <tr 
                  key={complaint.id} 
                  className={`complaint-row-main ${selectedComplaints.includes(complaint.id) ? 'selected' : ''}`}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedComplaints.includes(complaint.id)}
                      onChange={() => handleSelectComplaint(complaint.id)}
                    />
                  </td>
                  <td>{`${months[complaint.mes - 1]} ${complaint.año}`}</td>
                  <td>{complaint.cuenta}</td>
                  <td>{complaint.calle}</td>
                  <td>{complaint.numero}</td>
                  <td>{complaint.repartidor}</td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => handleEdit(complaint)} className="btn-edit">
                        <span className="icon">✎</span> Editar
                      </button>
                      <button onClick={() => handleDelete(complaint.id)} className="btn-delete">
                        <span className="icon">🗑</span> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
                <tr key={`${complaint.id}-details`} className="complaint-row-details">
                  <td></td>
                  <td><strong>Tomado por:</strong> {complaint.tomado_por || '-'}</td>
                  <td><strong>Teléfono:</strong> {complaint.telefono || '-'}</td>
                  <td><strong>Email:</strong> {complaint.mail || '-'}</td>
                  <td colSpan={2}><strong>Observaciones:</strong> {complaint.observaciones || '-'}</td>
                  <td>
                    <div className="status-indicators">
                      {complaint.entregar && <span className="status-badge entregar"><span className="icon">📦</span> Entregar</span>}
                      {complaint.emitido && <span className="status-badge emitido"><span className="icon">✓</span> Emitido</span>}
                      {complaint.enviar_por_mail && <span className="status-badge mail"><span className="icon">@</span> Email</span>}
                    </div>
                  </td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating Edit Modal */}
      {editingId && editingData && (
        <div className="modal-overlay" onClick={() => setEditingId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><span className="icon">✎</span> Editar Reclamo</h3>
              <button 
                className="modal-close" 
                onClick={() => {
                  setEditingId(null)
                  setEditingData(null)
                  setShowStreetSuggestions(false)
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-row">
                <div>
                  <label><span className="icon">📅</span> Mes:</label>
                  <select
                    value={editingData.mes}
                    onChange={(e) => setEditingData(prev => prev ? {...prev, mes: parseInt(e.target.value)} : null)}
                  >
                    {months.map((month, index) => (
                      <option key={index} value={index + 1}>{month}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label><span className="icon">📅</span> Año:</label>
                  <select
                    value={editingData.año}
                    onChange={(e) => setEditingData(prev => prev ? {...prev, año: parseInt(e.target.value)} : null)}
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label><span className="icon">#</span> Cuenta parte 1:</label>
                  <input
                    type="text"
                    value={editingCuenta1}
                    onChange={(e) => setEditingCuenta1(formatCuentaPart(e.target.value, true))}
                    onBlur={handleCuenta1Blur}
                    placeholder="1234567"
                    maxLength={7}
                  />
                </div>
                <div>
                  <label><span className="icon">#</span> Cuenta parte 2:</label>
                  <input
                    type="text"
                    value={editingCuenta2}
                    onChange={(e) => setEditingCuenta2(formatCuentaPart(e.target.value, false))}
                    onBlur={handleCuenta2Blur}
                    placeholder="123"
                    maxLength={3}
                  />
                </div>
              </div>

              <div className="autocomplete-container">
                <label><span className="icon">📍</span> Calle:</label>
                <input
                  type="text"
                  value={editingData.calle}
                  onChange={(e) => handleCalleChange(e.target.value)}
                  onFocus={() => editingData.calle && setShowStreetSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowStreetSuggestions(false), 200)}
                />
                {showStreetSuggestions && filteredStreets.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {filteredStreets.slice(0, 5).map((street, index) => (
                      <div 
                        key={index} 
                        className="autocomplete-item"
                        onClick={() => handleCalleSelect(street)}
                      >
                        {street}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label><span className="icon">🏠</span> Número:</label>
                <input
                  type="text"
                  value={editingData.numero}
                  onChange={(e) => setEditingData(prev => prev ? {...prev, numero: e.target.value} : null)}
                />
              </div>

              <div>
                <label><span className="icon">👤</span> Repartidor:</label>
                <input
                  type="text"
                  value={editingData.repartidor}
                  readOnly
                  style={{ backgroundColor: '#f8f9fa' }}
                  placeholder="Auto-completado"
                />
              </div>

              <div>
                <label><span className="icon">📞</span> Teléfono:</label>
                <input
                  type="tel"
                  value={editingData.telefono || ''}
                  onChange={(e) => setEditingData(prev => prev ? {...prev, telefono: formatTelefono(e.target.value)} : null)}
                  placeholder="Número de teléfono (solo números)"
                />
              </div>

              <div>
                <label><span className="icon">📝</span> Observaciones:</label>
                <textarea
                  value={editingData.observaciones || ''}
                  onChange={(e) => setEditingData(prev => prev ? {...prev, observaciones: e.target.value} : null)}
                  rows={3}
                />
              </div>

              {editingData.enviar_por_mail && (
                <div>
                  <label><span className="icon">@</span> Email:</label>
                  <input
                    type="email"
                    value={editingData.mail || ''}
                    onChange={(e) => setEditingData(prev => prev ? {...prev, mail: e.target.value} : null)}
                    placeholder="Email"
                    className={editingData.mail && !validateEmail(editingData.mail) ? 'invalid' : ''}
                  />
                </div>
              )}

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={editingData.entregar}
                    onChange={(e) => setEditingData(prev => prev ? {...prev, entregar: e.target.checked} : null)}
                  />
                  <span className="icon">📦</span> Entregar
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editingData.emitido}
                    onChange={(e) => setEditingData(prev => prev ? {...prev, emitido: e.target.checked} : null)}
                  />
                  <span className="icon">✓</span> Emitido
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={editingData.enviar_por_mail}
                    onChange={(e) => setEditingData(prev => prev ? {...prev, enviar_por_mail: e.target.checked} : null)}
                  />
                  <span className="icon">@</span> Enviar por email
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={handleUpdate} className="btn-save">
                <span className="icon">✓</span> Guardar Cambios
              </button>
              <button 
                onClick={() => {
                  setEditingId(null)
                  setEditingData(null)
                  setShowStreetSuggestions(false)
                }} 
                className="btn-cancel"
              >
                <span className="icon">×</span> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}