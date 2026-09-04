/**
 * DATASEED PÚBLICA — ONBOARDING ENGINE
 * Basado en Psicología de Ventas Conductual & CRO:
 * - Micro-compromisos & Consistencia (Cialdini)
 * - Efecto Zeigarnik & Endowed Progress (Inicio en 20%)
 * - Labor Illusion Effect (Harvard Business School)
 * - Auto-avance en 1 solo clic para reducir fricción
 * - Sincronización bidireccional de estado (ROI calculator, migración, reset y lifecycle)
 */

(function () {
  'use strict';

  // Configuración de métricas simuladas por rubro (Adaptadas a Ley 21.634 y mercado chileno)
  const INDUSTRY_METRICS = {
    construccion: {
      label: 'Construcción, Obras Civiles, MOP y MINVU',
      tenders: '48',
      amount: '$1.420.000.000 CLP',
      hoursSaved: '22 hrs/sem',
      competitors: '38 contratistas monitoreados',
      sampleTender: 'Conservación red vial cuenca sur — Dirección de Vialidad MOP (Ley 21.634)'
    },
    salud: {
      label: 'Salud, Cenabast, Fármacos e Insumos Médicos',
      tenders: '64',
      amount: '$780.000.000 CLP',
      hoursSaved: '24 hrs/sem',
      competitors: '52 distribuidores monitoreados',
      sampleTender: 'Suministro hospitalario y apósitos — Cenabast / SS Metropolitano'
    },
    tecnologia: {
      label: 'Tecnología, TI, Cloud & Ciberseguridad',
      tenders: '39',
      amount: '$560.000.000 CLP',
      hoursSaved: '18 hrs/sem',
      competitors: '31 empresas monitoreadas',
      sampleTender: 'Modernización de infraestructura y servicios cloud — Gobierno Digital / Hacienda'
    },
    servicios: {
      label: 'Servicios Profesionales, Consultoría & Auditoría',
      tenders: '53',
      amount: '$390.000.000 CLP',
      hoursSaved: '19 hrs/sem',
      competitors: '45 consultoras monitoreadas',
      sampleTender: 'Auditoría externa y asesoría técnica de gestión — GORE & Municipalidades'
    },
    seguridad: {
      label: 'Seguridad, Vigilancia y Mantención Integral',
      tenders: '44',
      amount: '$610.000.000 CLP',
      hoursSaved: '20 hrs/sem',
      competitors: '35 empresas monitoreados',
      sampleTender: 'Servicio de seguridad integral y control de acceso — Red Hospitalaria'
    },
    logistica: {
      label: 'Transporte, Flotas y Distribución Logística',
      tenders: '31',
      amount: '$340.000.000 CLP',
      hoursSaved: '16 hrs/sem',
      competitors: '24 operadores monitoreados',
      sampleTender: 'Arriendo de flota de vehículos y distribución territorial — Servicios Públicos'
    }
  };

  class OnboardingEngine {
    constructor() {
      this.currentStep = 1;
      this.totalSteps = 5;
      this.backdrop = document.getElementById('onboardBackdrop');
      this.modal = document.getElementById('onboardModal');
      this.progressFill = document.getElementById('onboardProgressFill');
      this.progressText = document.getElementById('onboardProgressText');
      this.stepBadge = document.getElementById('onboardStepBadge');
      this.backBtn = document.getElementById('onboardBackBtn');
      this.nextBtn = document.getElementById('onboardNextBtn');

      this.simulationTimers = [];
      this.simCompleted = false;
      this.isSubmitted = false;

      this.state = {
        rubro: 'construccion',
        painPoint: '',
        ticketRange: '',
        nombre: '',
        email: '',
        telefono: '',
        empresa: '',
        proveedorActual: '',
        intent: 'standard',
        sliderHours: null,
        sliderTicket: null,
        sliderTeam: null,
        appliedFromCalculator: false
      };

      this.hasExitIntentFired = false;
      this.init();
    }

    init() {
      if (!this.backdrop) return;

      // Recuperar estado previo si existe
      try {
        const saved = localStorage.getItem('dataseed_onboard_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.state = { ...this.state, ...parsed };
        }
      } catch (e) {}

      this.bindEvents();
      this.setupTriggers();
    }

    bindEvents() {
      // Cerrar modal
      document.querySelectorAll('.js-onboard-close').forEach(btn => {
        btn.addEventListener('click', () => this.close());
      });

      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) this.close();
      });

      // Botón reiniciar / nuevo diagnóstico
      document.querySelectorAll('.js-onboard-restart').forEach(btn => {
        btn.addEventListener('click', () => this.reset());
      });

      // Navegación Atrás
      if (this.backBtn) {
        this.backBtn.addEventListener('click', () => this.prevStep());
      }

      // Paso 1: Selección de Rubro (1-clic con auto-avance)
      document.querySelectorAll('.js-industry-select').forEach(card => {
        card.addEventListener('click', () => {
          document.querySelectorAll('.js-industry-select').forEach(c => c.classList.remove('is-selected'));
          card.classList.add('is-selected');
          const rubroKey = card.dataset.rubro || 'construccion';
          this.state.rubro = rubroKey;
          this.saveState();

          // Micro-compromiso: Auto avance fluido en 260ms
          setTimeout(() => {
            this.goToStep(2);
          }, 260);
        });
      });

      // Paso 2: Selección de Dolor (1-clic con auto-avance)
      document.querySelectorAll('.js-pain-select').forEach(option => {
        option.addEventListener('click', () => {
          document.querySelectorAll('.js-pain-select').forEach(o => o.classList.remove('is-selected'));
          option.classList.add('is-selected');
          this.state.painPoint = option.dataset.pain || '';
          this.saveState();

          setTimeout(() => {
            this.goToStep(3);
          }, 280);
        });
      });

      // Paso 3: Segmentación de Ticket (1-clic con auto-avance a simulación)
      document.querySelectorAll('.js-ticket-select').forEach(card => {
        card.addEventListener('click', () => {
          document.querySelectorAll('.js-ticket-select').forEach(c => c.classList.remove('is-selected'));
          card.classList.add('is-selected');
          this.state.ticketRange = card.dataset.ticket || '';
          this.saveState();

          setTimeout(() => {
            this.goToStep(4);
            this.runSimulation();
          }, 280);
        });
      });

      // Paso 4: Botón de continuar al paso 5
      const simContinueBtn = document.getElementById('simContinueBtn');
      if (simContinueBtn) {
        simContinueBtn.addEventListener('click', () => {
          this.goToStep(5);
        });
      }

      // Paso 5: Envío de Formulario Final
      const captureForm = document.getElementById('onboardCaptureForm');
      if (captureForm) {
        captureForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleFinalSubmit();
        });
      }
    }

    applyCalculatorInputs() {
      const sliderTicket = document.getElementById('sliderTicket');
      const sliderHours = document.getElementById('sliderHours');
      const sliderTeam = document.getElementById('sliderTeam');

      if (sliderTicket) {
        const val = parseInt(sliderTicket.value, 10);
        this.state.sliderTicket = val;
        if (val < 50) this.state.ticketRange = 'hasta_50m';
        else if (val <= 250) this.state.ticketRange = '50m_250m';
        else if (val <= 1000) this.state.ticketRange = '250m_1000m';
        else this.state.ticketRange = 'mas_1000m';
      }
      if (sliderHours) {
        this.state.sliderHours = parseInt(sliderHours.value, 10);
      }
      if (sliderTeam) {
        this.state.sliderTeam = parseInt(sliderTeam.value, 10);
      }
      this.state.appliedFromCalculator = true;
      this.saveState();
    }

    setupTriggers() {
      // Botones con trigger en la landing
      document.querySelectorAll('[data-onboard-trigger], .js-open-onboarding, a[href="#onboarding"]').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
          const href = trigger.getAttribute('href');
          // Si es un enlace a una sección de la landing (ej: #migracion), permitir navegación nativa
          if (href && href.startsWith('#') && href !== '#onboarding') {
            return;
          }
          e.preventDefault();

          // Si proviene del botón de la calculadora de ROI
          if (trigger.id === 'calcOnboardBtn' || trigger.dataset.from === 'calculator') {
            this.applyCalculatorInputs();
          }

          const targetRubro = trigger.dataset.rubro;
          const targetIntent = trigger.dataset.intent || trigger.dataset.onboardTrigger;

          if (targetRubro) {
            this.state.rubro = targetRubro;
          }
          if (targetIntent) {
            this.state.intent = targetIntent;
            if (targetIntent === 'migration') {
              this.state.painPoint = 'licitalab_cost';
              this.state.proveedorActual = 'licitalab';
            }
          }
          this.open();
        });
      });

      // Exit-intent trigger en desktop
      document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= 0 && !this.hasExitIntentFired && !this.isOpen()) {
          this.hasExitIntentFired = true;
          const dismissed = sessionStorage.getItem('dataseed_exit_intent_seen');
          if (!dismissed) {
            sessionStorage.setItem('dataseed_exit_intent_seen', 'true');
            this.open();
          }
        }
      });
    }

    clearSimulationTimers() {
      if (this.simulationTimers && this.simulationTimers.length) {
        this.simulationTimers.forEach(id => clearTimeout(id));
        this.simulationTimers = [];
      }
    }

    reset() {
      this.clearSimulationTimers();
      this.currentStep = 1;
      this.isSubmitted = false;
      this.simCompleted = false;

      const step5El = document.querySelector('.onboard-step[data-step="5"]');
      const successEl = document.getElementById('onboardSuccess');
      if (step5El) step5El.style.display = '';
      if (successEl) successEl.style.display = 'none';

      this.updateStepUI();
    }

    open(step = null) {
      if (this.isSubmitted) {
        this.reset();
      }
      if (step) {
        this.currentStep = step;
      }
      this.backdrop.classList.add('is-active');
      document.body.style.overflow = 'hidden';
      this.updateStepUI();
    }

    close() {
      this.clearSimulationTimers();
      this.backdrop.classList.remove('is-active');
      document.body.style.overflow = '';
    }

    isOpen() {
      return this.backdrop && this.backdrop.classList.contains('is-active');
    }

    goToStep(stepNumber) {
      if (stepNumber < 1 || stepNumber > this.totalSteps) return;
      this.currentStep = stepNumber;
      this.updateStepUI();
    }

    prevStep() {
      if (this.currentStep > 1) {
        this.clearSimulationTimers();
        const prev = this.currentStep - 1;
        this.goToStep(prev);

        // Si vuelve a Step 4 y ya se había completado la simulación, mostrar métricas de inmediato
        if (prev === 4 && this.simCompleted) {
          const revealMetrics = document.getElementById('simMetricsReveal');
          const continueBtn = document.getElementById('simContinueBtn');
          if (revealMetrics) revealMetrics.style.display = 'grid';
          if (continueBtn) continueBtn.style.display = 'inline-flex';
        }
      }
    }

    updateStepUI() {
      // Ocultar todos los pasos
      document.querySelectorAll('.onboard-step').forEach(stepEl => {
        stepEl.classList.remove('is-active');
      });

      // Activar paso actual
      const activeStepEl = document.querySelector(`.onboard-step[data-step="${this.currentStep}"]`);
      if (activeStepEl) {
        activeStepEl.classList.add('is-active');
      }

      // Sincronizar selección visual en Step 1
      document.querySelectorAll('.js-industry-select').forEach(card => {
        card.classList.toggle('is-selected', card.dataset.rubro === this.state.rubro);
      });

      // Sincronizar selección visual en Step 2
      document.querySelectorAll('.js-pain-select').forEach(option => {
        option.classList.toggle('is-selected', option.dataset.pain === this.state.painPoint);
      });

      // Sincronizar selección visual en Step 3
      document.querySelectorAll('.js-ticket-select').forEach(card => {
        card.classList.toggle('is-selected', card.dataset.ticket === this.state.ticketRange);
      });

      // Sincronizar campos en Step 5
      const nameInput = document.getElementById('onboardName');
      const emailInput = document.getElementById('onboardEmail');
      const phoneInput = document.getElementById('onboardPhone');
      const companyInput = document.getElementById('onboardCompany');
      const providerInput = document.getElementById('onboardProvider');
      if (nameInput && !nameInput.value && this.state.nombre) nameInput.value = this.state.nombre;
      if (emailInput && !emailInput.value && this.state.email) emailInput.value = this.state.email;
      if (phoneInput && !phoneInput.value && this.state.telefono) phoneInput.value = this.state.telefono;
      if (companyInput && !companyInput.value && this.state.empresa) companyInput.value = this.state.empresa;
      if (providerInput && this.state.proveedorActual) providerInput.value = this.state.proveedorActual;

      // Barra de progreso y badges (Endowed Progress: inicia en 20%)
      const progressPercent = Math.min(100, Math.round((this.currentStep / this.totalSteps) * 100));
      if (this.progressFill) {
        this.progressFill.style.width = `${progressPercent}%`;
      }
      if (this.progressText) {
        this.progressText.textContent = `${progressPercent}% COMPLETADO`;
      }

      const stepTitles = [
        'PASO 1 DE 5 · CONFIGURACIÓN DEL RADAR',
        'PASO 2 DE 5 · DIAGNÓSTICO DE DESAFÍO',
        'PASO 3 DE 5 · PERFIL DE ADJUDICACIÓN',
        'PASO 4 DE 5 · SIMULACIÓN EN VIVO',
        'PASO 5 DE 5 · REPORTE PERSONALIZADO'
      ];
      if (this.stepBadge) {
        this.stepBadge.textContent = stepTitles[this.currentStep - 1] || 'DIAGNÓSTICO PÚBLICA';
      }

      // Control del botón atrás (visible en pasos 2 a 5)
      if (this.backBtn) {
        this.backBtn.style.visibility = (this.currentStep > 1 && this.currentStep <= 5) ? 'visible' : 'hidden';
      }
    }

    runSimulation() {
      this.clearSimulationTimers();
      this.simCompleted = false;

      const rubroData = INDUSTRY_METRICS[this.state.rubro] || INDUSTRY_METRICS.construccion;
      const streamContainer = document.getElementById('terminalStream');
      const revealMetrics = document.getElementById('simMetricsReveal');
      const continueBtn = document.getElementById('simContinueBtn');

      if (!streamContainer) return;

      streamContainer.innerHTML = '';
      if (revealMetrics) revealMetrics.style.display = 'none';
      if (continueBtn) continueBtn.style.display = 'none';

      // Actualizar datos del rubro en la vista
      const labelEl = document.getElementById('simRubroName');
      if (labelEl) labelEl.textContent = rubroData.label;

      const lines = [
        '> Conectando a APIs de ChileCompra & Módulo Obras MOP/MINVU...',
        `> Filtrando rubro [${rubroData.label}] bajo estándares Ley N° 21.634...`,
        `> Detectadas ${rubroData.tenders} licitaciones abiertas con cierre < 15 días.`,
        '> Auditando bases por causales de inadmisibilidad técnica y sesgos...',
        `> Analizando referencias de precios históricos vs ${rubroData.competitors}...`,
        '> [OK] Diagnóstico de Cumplimiento & Radar de Mercado generado exitosamente.'
      ];

      // Animación secuencial con efecto Labor Illusion
      lines.forEach((lineText, index) => {
        const timerId = setTimeout(() => {
          const p = document.createElement('div');
          p.className = 'terminal-line';
          p.textContent = lineText;
          streamContainer.appendChild(p);

          // Al terminar las líneas, revelar métricas de impacto
          if (index === lines.length - 1) {
            const finalTimerId = setTimeout(() => {
              this.simCompleted = true;
              if (revealMetrics) {
                revealMetrics.style.display = 'grid';
                const tenderEl = document.getElementById('simValTenders');
                const amountEl = document.getElementById('simValAmount');
                const hoursEl = document.getElementById('simValHours');

                if (this.state.appliedFromCalculator && this.state.sliderHours) {
                  if (tenderEl) tenderEl.textContent = rubroData.tenders;
                  if (amountEl) amountEl.textContent = `$${this.state.sliderTicket}M CLP (Ticket)`;
                  if (hoursEl) hoursEl.textContent = `${Math.round(this.state.sliderHours * 0.85)} hrs/sem`;
                } else {
                  if (tenderEl) tenderEl.textContent = rubroData.tenders;
                  if (amountEl) amountEl.textContent = rubroData.amount;
                  if (hoursEl) hoursEl.textContent = rubroData.hoursSaved;
                }
              }
              if (continueBtn) {
                continueBtn.style.display = 'inline-flex';
              }
            }, 400);
            this.simulationTimers.push(finalTimerId);
          }
        }, (index + 1) * 450);

        this.simulationTimers.push(timerId);
      });
    }

    handleFinalSubmit() {
      const nameInput = document.getElementById('onboardName');
      const emailInput = document.getElementById('onboardEmail');
      const phoneInput = document.getElementById('onboardPhone');
      const companyInput = document.getElementById('onboardCompany');
      const providerInput = document.getElementById('onboardProvider');

      this.state.nombre = nameInput ? nameInput.value.trim() : '';
      this.state.email = emailInput ? emailInput.value.trim() : '';
      this.state.telefono = phoneInput ? phoneInput.value.trim() : '';
      this.state.empresa = companyInput ? companyInput.value.trim() : '';
      this.state.proveedorActual = providerInput ? providerInput.value : '';

      this.saveState();
      this.isSubmitted = true;

      // Transición a pantalla de éxito
      const step5El = document.querySelector('.onboard-step[data-step="5"]');
      const successEl = document.getElementById('onboardSuccess');

      if (step5El) step5El.style.display = 'none';
      if (successEl) {
        successEl.style.display = 'block';
        const clientNameEl = document.getElementById('successClientName');
        if (clientNameEl) clientNameEl.textContent = this.state.nombre || 'tu equipo';
      }

      // Ocultar botón atrás en pantalla de éxito
      if (this.backBtn) this.backBtn.style.visibility = 'hidden';

      // Simulación de envío a endpoint (Formspree / CRM webhook)
      try {
        fetch('https://formspree.io/f/xzdwykww', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            producto: 'Pública by DataSeed (Onboarding Multi-Paso)',
            rubro: this.state.rubro,
            desafio: this.state.painPoint,
            ticket: this.state.ticketRange,
            nombre: this.state.nombre,
            email: this.state.email,
            telefono: this.state.telefono,
            empresa: this.state.empresa,
            proveedor_actual: this.state.proveedorActual,
            intencion: this.state.intent,
            horas_semanales_busqueda: this.state.sliderHours || null,
            ticket_promedio_m: this.state.sliderTicket || null,
            usuarios_equipo: this.state.sliderTeam || null,
            fecha: new Date().toISOString()
          })
        }).catch(() => {});
      } catch (e) {}
    }

    saveState() {
      try {
        localStorage.setItem('dataseed_onboard_state', JSON.stringify(this.state));
      } catch (e) {}
    }
  }

  // Inicializar en el DOM
  document.addEventListener('DOMContentLoaded', () => {
    window.onboardingEngine = new OnboardingEngine();
  });

})();
