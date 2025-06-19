import { useState, useEffect } from 'react'
import { supabase, Complaint } from '../lib/supabase'
import * as XLSX from 'xlsx'
import React from 'react'

type StatisticsData = {
  [repartidor: string]: {
    [calle: string]: {
      [numero: string]: {
        count: number;
        cuentas: string[];
      }
    }
  }
}

export default function Statistics() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedRepartidor, setSelectedRepartidor] = useState('')
  const [statistics, setStatistics] = useState<StatisticsData>({})

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i)

  useEffect(() => {
    fetchComplaints()
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    generateStatistics()
  }, [complaints, selectedRepartidor])

  const fetchComplaints = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('user_id', user?.id)
      .eq('mes', selectedMonth)
      .eq('año', selectedYear)

    if (error) {
      console.error('Error fetching complaints:', error)
    } else {
      setComplaints(data || [])
    }
  }

  const generateStatistics = () => {
    const filteredComplaints = selectedRepartidor 
      ? complaints.filter(c => c.repartidor === selectedRepartidor)
      : complaints

    const stats: StatisticsData = {}

    filteredComplaints.forEach(complaint => {
      if (!stats[complaint.repartidor]) {
        stats[complaint.repartidor] = {}
      }
      if (!stats[complaint.repartidor][complaint.calle]) {
        stats[complaint.repartidor][complaint.calle] = {}
      }
      if (!stats[complaint.repartidor][complaint.calle][complaint.numero]) {
        stats[complaint.repartidor][complaint.calle][complaint.numero] = {
          count: 0,
          cuentas: []
        }
      }
      stats[complaint.repartidor][complaint.calle][complaint.numero].count++
      if (!stats[complaint.repartidor][complaint.calle][complaint.numero].cuentas.includes(complaint.cuenta)) {
        stats[complaint.repartidor][complaint.calle][complaint.numero].cuentas.push(complaint.cuenta)
      }
    })

    setStatistics(stats)
  }

  const getUniqueRepartidores = () => {
    return [...new Set(complaints.map(c => c.repartidor))]
  }

  const getTotalForRepartidor = (repartidor: string) => {
    let total = 0
    Object.values(statistics[repartidor] || {}).forEach(calle => {
      Object.values(calle).forEach(data => {
        total += data.count
      })
    })
    return total
  }

  const exportRepartidorToExcel = (repartidor: string) => {
    const workbook = XLSX.utils.book_new()
    const calles = statistics[repartidor] || {}
    
    const distributorData = [
      [`REPORTE INDIVIDUAL - ${repartidor.toUpperCase()}`],
      [''],
      [`Periodo: ${months[selectedMonth - 1]} ${selectedYear}`],
      [`Total de Reclamos: ${getTotalForRepartidor(repartidor)}`],
      [`Generado: ${new Date().toLocaleDateString()}`],
      [''],
      ['Calle', 'Número', 'Cantidad', 'Cuentas', 'Observaciones', 'Detalles']
    ]

    // Add detailed data with empty cells for repeated streets
    Object.entries(calles).forEach(([calle, numeros]) => {
      let isFirstRowForStreet = true
      Object.entries(numeros).forEach(([numero, data]) => {
        const addressComplaints = complaints.filter(c => 
          c.repartidor === repartidor && 
          c.calle === calle && 
          c.numero === numero
        )
        
        const observaciones = addressComplaints
          .map(c => c.observaciones)
          .filter(obs => obs && obs.trim())
          .join('; ')

        const cuentas = data.cuentas.join(', ')

        const detalles = addressComplaints
          .map(c => `${c.mail ? `Email: ${c.mail}` : ''}${c.telefono ? ` | Tel: ${c.telefono}` : ''}`)
          .filter(detail => detail.trim())
          .join(' || ')

        // Only show street name for the first row of each street
        distributorData.push([
          isFirstRowForStreet ? calle : '', 
          numero, 
          data.count.toString(), 
          cuentas, 
          observaciones, 
          detalles
        ])
        
        isFirstRowForStreet = false
      })
    })

    // Add summary
    distributorData.push(['', '', '', '', '', ''])
    distributorData.push(['TOTAL GENERAL', '', getTotalForRepartidor(repartidor).toString(), '', '', ''])

    const sheet = XLSX.utils.aoa_to_sheet(distributorData)
    
    // Enhanced styling
    sheet['!cols'] = [
      { width: 30 }, // Calle
      { width: 10 }, // Número
      { width: 12 }, // Cantidad
      { width: 25 }, // Cuentas
      { width: 40 }, // Observaciones
      { width: 60 }  // Detalles
    ]

    XLSX.utils.book_append_sheet(workbook, sheet, repartidor.substring(0, 31))
    
    const filename = `${repartidor}_${months[selectedMonth - 1]}_${selectedYear}.xlsx`
    XLSX.writeFile(workbook, filename)
  }

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new()
    
    // Create a summary sheet first
    const summaryData = [
      ['REPORTE DE RECLAMOS'],
      [''],
      [`Periodo: ${months[selectedMonth - 1]} ${selectedYear}`],
      [`Generado: ${new Date().toLocaleDateString()}`],
      [''],
      ['RESUMEN POR REPARTIDOR'],
      ['Repartidor', 'Total Reclamos']
    ]

    Object.keys(statistics).forEach(repartidor => {
      summaryData.push([repartidor, getTotalForRepartidor(repartidor).toString()])
    })

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    
    // Style the summary sheet
    summarySheet['!cols'] = [{ width: 25 }, { width: 15 }]
    
    // Add styles to title
    if (summarySheet['A1']) {
      summarySheet['A1'].s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: 'center' }
      }
    }

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen')

    // Create individual sheets for each distributor with empty cells for repeated streets
    Object.entries(statistics).forEach(([repartidor, calles]) => {
      const distributorData = [
        [`RECLAMOS - ${repartidor.toUpperCase()}`],
        [''],
        [`Periodo: ${months[selectedMonth - 1]} ${selectedYear}`],
        [`Total de Reclamos: ${getTotalForRepartidor(repartidor)}`],
        [''],
        ['Calle', 'Número', 'Cantidad', 'Cuentas', 'Observaciones']
      ]

      // Add data rows with empty cells for repeated streets
      Object.entries(calles).forEach(([calle, numeros]) => {
        let isFirstRowForStreet = true
        Object.entries(numeros).forEach(([numero, data]) => {
          // Get complaints for this specific address
          const addressComplaints = complaints.filter(c => 
            c.repartidor === repartidor && 
            c.calle === calle && 
            c.numero === numero
          )
          
          const observaciones = addressComplaints
            .map(c => c.observaciones)
            .filter(obs => obs && obs.trim())
            .join('; ')

          const cuentas = data.cuentas.join(', ')

          // Only show street name for the first row of each street
          distributorData.push([
            isFirstRowForStreet ? calle : '', 
            numero, 
            data.count.toString(), 
            cuentas, 
            observaciones
          ])
          
          isFirstRowForStreet = false
        })
      })

      // Add total row
      distributorData.push(['', '', '', '', ''])
      distributorData.push(['TOTAL GENERAL', '', getTotalForRepartidor(repartidor).toString(), '', ''])

      const distributorSheet = XLSX.utils.aoa_to_sheet(distributorData)
      
      // Style the distributor sheet
      distributorSheet['!cols'] = [
        { width: 30 }, // Calle
        { width: 10 }, // Número
        { width: 12 }, // Cantidad
        { width: 25 }, // Cuentas
        { width: 50 }  // Observaciones
      ]

      // Clean repartidor name for sheet name (Excel sheet name restrictions)
      const cleanSheetName = repartidor.replace(/[^\w\s]/g, '').substring(0, 31)
      XLSX.utils.book_append_sheet(workbook, distributorSheet, cleanSheetName)
    })

    // Generate filename with current date and period
    const filename = `Reclamos_${months[selectedMonth - 1]}_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`
    
    // Save the file
    XLSX.writeFile(workbook, filename)
  }

  // Add hover effect handlers for street grouping
  const handleStreetHover = (street: string, isHovering: boolean) => {
    const rows = document.querySelectorAll(`tr[data-street="${street}"]`)
    rows.forEach(row => {
      if (isHovering) {
        row.classList.add('street-group-hover')
      } else {
        row.classList.remove('street-group-hover')
      }
    })
  }

  return (
    <div className="statistics">
      <h2><img src="/reclamos-osm/img/logo.png" alt="Logo" className="page-logo" /> Estadísticas de Reclamos</h2>
      
      <div className="filters">
        <div>
          <label><span className="icon">📅</span> Mes:</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {months.map((month, index) => (
              <option key={index} value={index + 1}>{month}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label><span className="icon">📅</span> Año:</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div>
          <label><span className="icon">👤</span> Repartidor:</label>
          <select 
            value={selectedRepartidor} 
            onChange={(e) => setSelectedRepartidor(e.target.value)}
          >
            <option value="">Todos</option>
            {getUniqueRepartidores().map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="export-section">
        <div className="export-buttons">
          <button 
            className="btn btn-success export-btn"
            onClick={exportToExcel}
            disabled={Object.keys(statistics).length === 0}
          >
            <span className="icon">📊</span> Exportar Todo a Excel
          </button>
          
          {Object.keys(statistics).length > 0 && (
            <div className="individual-exports">
              <span className="export-label">Exportar individual:</span>
              {Object.keys(statistics).map(repartidor => (
                <button
                  key={repartidor}
                  className="btn btn-primary export-btn-small"
                  onClick={() => exportRepartidorToExcel(repartidor)}
                >
                  <span className="icon">👤</span> {repartidor}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="statistics-table">
        <h3>Mes: {months[selectedMonth - 1]}</h3>
        
        {Object.entries(statistics).map(([repartidor, calles]) => (
          <div key={repartidor} className="repartidor-section">
            <h4><span className="icon">👤</span> {repartidor}</h4>
            
            <table>
              <thead>
                <tr>
                  <th><span className="icon">📍</span> Calle</th>
                  <th><span className="icon">🏠</span> Nro.</th>
                  <th><span className="icon">💳</span> Cuentas</th>
                  <th><span className="icon">📊</span> Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(calles).map(([calle, numeros]) => {
                  const numeroEntries = Object.entries(numeros)
                  return (
                    <React.Fragment key={calle}>
                      {numeroEntries.map(([numero, data], index) => (
                        <tr 
                          key={`${calle}-${numero}`} 
                          className="number-row"
                          data-street={calle}
                          onMouseEnter={() => handleStreetHover(calle, true)}
                          onMouseLeave={() => handleStreetHover(calle, false)}
                        >
                          {index === 0 ? (
                            <td 
                              rowSpan={numeroEntries.length} 
                              className="street-header"
                            >
                              {calle}
                            </td>
                          ) : null}
                          <td>{numero}</td>
                          <td>{data.cuentas.join(', ')}</td>
                          <td>{data.count}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
                <tr className="total-row">
                  <td colSpan={3}><strong><span className="icon">Σ</span> Total general</strong></td>
                  <td><strong>{getTotalForRepartidor(repartidor)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}