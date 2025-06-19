import { useState, useEffect } from 'react'
import { supabase, Distributor } from '../lib/supabase'

export default function ComplaintForm() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [filteredStreets, setFilteredStreets] = useState<string[]>([])
  const [formData, setFormData] = useState({
    mes: new Date().getMonth() + 1,
    año: new Date().getFullYear(),
    cuenta1: '',
    cuenta2: '',
    calle: '',
    numero: '',
    repartidor: '',
    observaciones: '',
    entregar: false,
    emitido: false,
    enviar_por_mail: false,
    mail: '',
    telefono: '',
    tomado_por: ''
  })
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [similarComplaints, setSimilarComplaints] = useState<any[]>([])
  const [showSimilarWarning, setShowSimilarWarning] = useState(false)

  useEffect(() => {
    fetchDistributors()
    setCurrentUser()
  }, [])

  const setCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setFormData(prev => ({ ...prev, tomado_por: user.email || '' }))
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

  const handleCalleChange = (value: string) => {
    setFormData({ ...formData, calle: value, repartidor: '' })
    
    if (value.length > 0) {
      const filtered = distributors
        .filter(d => d.calle.toLowerCase().includes(value.toLowerCase()))
        .map(d => d.calle)
      setFilteredStreets([...new Set(filtered)])
    } else {
      setFilteredStreets([])
    }
  }

  const handleCalleSelect = (calle: string) => {
    setFormData({ ...formData, calle, repartidor: '' })
    setFilteredStreets([])
    
    // Auto-fill repartidor based on selected street
    const distributor = distributors.find(d => d.calle === calle)
    if (distributor) {
      setFormData(prev => ({ ...prev, calle, repartidor: distributor.repartidor }))
    }
  }

  const formatCuentaPart = (value: string, isFirst: boolean) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '')
    
    if (isFirst) {
      // First part: max 7 digits, pad with zeros when leaving field
      return digits.slice(0, 7)
    } else {
      // Second part: max 3 digits, pad with zeros when leaving field
      return digits.slice(0, 3)
    }
  }

  const handleCuenta1Blur = () => {
    if (formData.cuenta1) {
      const padded = formData.cuenta1.padStart(7, '0')
      setFormData({ ...formData, cuenta1: padded })
    }
  }

  const handleCuenta2Blur = () => {
    if (formData.cuenta2) {
      const padded = formData.cuenta2.padStart(3, '0')
      setFormData({ ...formData, cuenta2: padded })
    }
  }

  const validateCuenta = () => {
    return formData.cuenta1.length === 7 && formData.cuenta2.length === 3
  }

  const validateEmail = (email: string) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(email)
  }

  const checkForSimilarComplaints = async (cuenta: string) => {
    if (!cuenta) return []

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      // Check for complaints with same account in the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('user_id', currentUser?.id)
        .eq('cuenta', cuenta)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error checking similar complaints:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in checkForSimilarComplaints:', error)
      return []
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateCuenta()) {
      alert('Formato de cuenta inválido. Complete ambos campos')
      return
    }

    if (formData.enviar_por_mail && !validateEmail(formData.mail)) {
      alert('Email inválido')
      return
    }

    // Check for similar complaints before showing confirmation
    const cuenta = `${formData.cuenta1}/${formData.cuenta2}`
    const similar = await checkForSimilarComplaints(cuenta)
    setSimilarComplaints(similar)

    if (similar.length > 0) {
      setShowSimilarWarning(true)
    } else {
      setShowConfirmModal(true)
    }
  }

  const handleConfirmSubmit = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      const complaintData = {
        ...formData,
        cuenta: `${formData.cuenta1}/${formData.cuenta2}`,
        user_id: currentUser?.id
      }
      
      // Remove cuenta1 and cuenta2 from the data being sent
      const { cuenta1, cuenta2, ...dataToSend } = complaintData

      const { error } = await supabase
        .from('complaints')
        .insert([dataToSend])

      if (error) throw error
      
      alert('Reclamo enviado exitosamente')
      setShowConfirmModal(false)
      setShowSimilarWarning(false)
      
      // Reset form but keep current user
      const { data: { user: resetUser } } = await supabase.auth.getUser()
      setFormData({
        mes: new Date().getMonth() + 1,
        año: new Date().getFullYear(),
        cuenta1: '',
        cuenta2: '',
        calle: '',
        numero: '',
        repartidor: '',
        observaciones: '',
        entregar: false,
        emitido: false,
        enviar_por_mail: false,
        mail: '',
        telefono: '',
        tomado_por: resetUser?.email || ''
      })
    } catch (error: any) {
      alert('Error al enviar reclamo: ' + error.message)
    }
  }

  const handleContinueWithSimilar = () => {
    setShowSimilarWarning(false)
    setShowConfirmModal(true)
  }

  const formatTelefono = (value: string) => {
    // Remove all non-numeric characters including dashes
    return value.replace(/\D/g, '')
  }

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i)
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  return (
    <div className="complaint-form">
      <h2><img src="/reclamos-osm/img/logo.png" alt="Logo" className="page-logo" /> Nuevo Reclamo</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div>
            <label><span className="icon">📅</span> Mes:</label>
            <select 
              value={formData.mes} 
              onChange={(e) => setFormData({...formData, mes: parseInt(e.target.value)})}
              required
            >
              {months.map((month, index) => (
                <option key={index} value={index + 1}>{month}</option>
              ))}
            </select>
          </div>
          <div>
            <label><span className="icon">📅</span> Año:</label>
            <select 
              value={formData.año} 
              onChange={(e) => setFormData({...formData, año: parseInt(e.target.value)})}
              required
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label><span className="icon">#</span> Cuenta parte 1 (7 dígitos):</label>
            <input
              type="text"
              value={formData.cuenta1}
              onChange={(e) => setFormData({...formData, cuenta1: formatCuentaPart(e.target.value, true)})}
              onBlur={handleCuenta1Blur}
              placeholder="1234567"
              maxLength={7}
              required
            />
          </div>
          <div>
            <label><span className="icon">#</span> Cuenta parte 2 (3 dígitos):</label>
            <input
              type="text"
              value={formData.cuenta2}
              onChange={(e) => setFormData({...formData, cuenta2: formatCuentaPart(e.target.value, false)})}
              onBlur={handleCuenta2Blur}
              placeholder="123"
              maxLength={3}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="autocomplete-container">
            <label><span className="icon">📍</span> Calle:</label>
            <input
              type="text"
              value={formData.calle}
              onChange={(e) => handleCalleChange(e.target.value)}
              placeholder="Escriba para buscar calles..."
              required
            />
            {filteredStreets.length > 0 && (
              <div className="autocomplete-dropdown">
                {filteredStreets.slice(0, 10).map((street, index) => (
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
              value={formData.numero}
              onChange={(e) => setFormData({...formData, numero: e.target.value})}
              required
            />
          </div>
          <div>
            <label><span className="icon">👤</span> Repartidor:</label>
            <input
              type="text"
              value={formData.repartidor}
              onChange={(e) => setFormData({...formData, repartidor: e.target.value})}
              placeholder="Se completará automáticamente"
              readOnly
              style={{ backgroundColor: '#f8f9fa' }}
            />
          </div>
        </div>

        <div>
          <label><span className="icon">📝</span> Observaciones:</label>
          <textarea
            value={formData.observaciones}
            onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
            rows={3}
          />
        </div>

        <div>
          <label><span className="icon">📞</span> Teléfono (opcional):</label>
          <input
            type="tel"
            value={formData.telefono}
            onChange={(e) => setFormData({...formData, telefono: formatTelefono(e.target.value)})}
            placeholder="Número de teléfono (solo números)"
          />
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.entregar}
              onChange={(e) => setFormData({...formData, entregar: e.target.checked})}
            />
            <span className="icon">📦</span> Entregar
          </label>
          <label>
            <input
              type="checkbox"
              checked={formData.emitido}
              onChange={(e) => setFormData({...formData, emitido: e.target.checked})}
            />
            <span className="icon">✓</span> Emitido?
          </label>
          <label>
            <input
              type="checkbox"
              checked={formData.enviar_por_mail}
              onChange={(e) => setFormData({...formData, enviar_por_mail: e.target.checked})}
            />
            <span className="icon">@</span> Enviar por mail
          </label>
        </div>

        {formData.enviar_por_mail && (
          <div>
            <label><span className="icon">@</span> Email:</label>
            <input
              type="email"
              value={formData.mail}
              onChange={(e) => setFormData({...formData, mail: e.target.value})}
              required
            />
          </div>
        )}

        <button type="submit"><span className="icon">✓</span> Enviar Reclamo</button>
      </form>

      {/* Similar Complaints Warning Modal */}
      {showSimilarWarning && (
        <div className="modal-overlay" onClick={() => setShowSimilarWarning(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><span className="icon">⚠️</span> Reclamos Similares Encontrados</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowSimilarWarning(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <p>Se encontraron <strong>{similarComplaints.length}</strong> reclamo(s) reciente(s) para la cuenta <strong>{formData.cuenta1}/{formData.cuenta2}</strong>:</p>
              
              <div style={{ maxHeight: '200px', overflowY: 'auto', margin: '1rem 0' }}>
                {similarComplaints.map((complaint, index) => (
                  <div key={complaint.id} style={{ 
                    padding: '0.75rem', 
                    marginBottom: '0.5rem', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '6px',
                    border: '1px solid #e9ecef'
                  }}>
                    <strong>#{index + 1}</strong> - {months[complaint.mes - 1]} {complaint.año}
                    <br />
                    <small>📍 {complaint.calle} {complaint.numero} - 👤 {complaint.repartidor}</small>
                    <br />
                    <small>📅 {new Date(complaint.created_at).toLocaleDateString()}</small>
                    {complaint.observaciones && (
                      <>
                        <br />
                        <small>📝 {complaint.observaciones}</small>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              <p><strong>¿Está seguro de que desea enviar un nuevo reclamo para esta cuenta?</strong></p>
            </div>

            <div className="modal-footer">
              <button onClick={handleContinueWithSimilar} className="btn-save">
                <span className="icon">✓</span> Sí, continuar
              </button>
              <button onClick={() => setShowSimilarWarning(false)} className="btn-cancel">
                <span className="icon">×</span> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><span className="icon">✓</span> Confirmar Reclamo</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowConfirmModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <h4>Por favor verifique la información antes de enviar:</h4>
              
              <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '6px', margin: '1rem 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <strong>📅 Período:</strong><br />
                    {months[formData.mes - 1]} {formData.año}
                  </div>
                  <div>
                    <strong>💳 Cuenta:</strong><br />
                    {formData.cuenta1}/{formData.cuenta2}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <strong>📍 Calle:</strong><br />
                    {formData.calle}
                  </div>
                  <div>
                    <strong>🏠 Número:</strong><br />
                    {formData.numero}
                  </div>
                  <div>
                    <strong>👤 Repartidor:</strong><br />
                    {formData.repartidor}
                  </div>
                </div>

                {formData.telefono && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>📞 Teléfono:</strong> {formData.telefono}
                  </div>
                )}

                {formData.observaciones && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>📝 Observaciones:</strong><br />
                    {formData.observaciones}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {formData.entregar && (
                    <span className="status-badge entregar">
                      <span className="icon">📦</span> Entregar
                    </span>
                  )}
                  {formData.emitido && (
                    <span className="status-badge emitido">
                      <span className="icon">✓</span> Emitido
                    </span>
                  )}
                  {formData.enviar_por_mail && (
                    <span className="status-badge mail">
                      <span className="icon">@</span> Enviar por Email
                    </span>
                  )}
                </div>

                {formData.enviar_por_mail && formData.mail && (
                  <div style={{ marginTop: '1rem' }}>
                    <strong>📧 Email:</strong> {formData.mail}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={handleConfirmSubmit} className="btn-save">
                <span className="icon">✓</span> Confirmar y Enviar
              </button>
              <button onClick={() => setShowConfirmModal(false)} className="btn-cancel">
                <span className="icon">✎</span> Editar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}