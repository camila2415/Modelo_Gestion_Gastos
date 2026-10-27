/* ==========================================================================
   MÓDULO PRINCIPAL DE GESTIÓN DE GASTOS (SGG - GRAND LINE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // 1. CONTROL DE TEMA (SOL / NOCHE) CON PERSISTENCIA
    // ----------------------------------------------------------------------
    const btnTema = document.getElementById('btnTema');
    const temaGuardado = localStorage.getItem('sgg_tema');

    if (temaGuardado === 'dark') {
        document.body.classList.add('dark-mode');
    }

    if (btnTema) {
        btnTema.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const esOscuro = document.body.classList.contains('dark-mode');
            localStorage.setItem('sgg_tema', esOscuro ? 'dark' : 'light');
        });
    }

    // ----------------------------------------------------------------------
    // 2. CONTROL DE SESIÓN DE USUARIO
    // ----------------------------------------------------------------------
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas desembarcar del puerto?')) {
                localStorage.removeItem('sgg_usuario_activo');
                window.location.href = 'index.html';
            }
        });
    }

    // ----------------------------------------------------------------------
    // 3. ESTRUCTURA DE DATOS Y PERSISTENCIA (OPFS / LocalStorage)
    // ----------------------------------------------------------------------
    const STORAGE_KEY = 'sgg_transacciones_v1';
    let transacciones = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

    function guardarEnStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transacciones));
    }

    // ----------------------------------------------------------------------
    // 4. INSTANCIAS DE GRÁFICOS (Chart.js)
    // ----------------------------------------------------------------------
    let chartCategoriasInstance = null;
    let chartBalanceInstance = null;

    function inicializarGraficos() {
        const ctxCat = document.getElementById('chartCategorias');
        const ctxBal = document.getElementById('chartBalance');

        if (!ctxCat || !ctxBal) return;

        // Gráfico de Categorías (Dona)
        chartCategoriasInstance = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
                        '#8b5cf6', '#ec4899', '#64748b'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        // Gráfico Balance Ingresos vs Gastos (Barras)
        chartBalanceInstance = new Chart(ctxBal, {
            type: 'bar',
            data: {
                labels: ['Ingresos (Botín)', 'Gastos'],
                datasets: [{
                    label: 'Monto Total ($)',
                    data: [0, 0],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // ----------------------------------------------------------------------
    // 5. RENDERING Y ACTUALIZACIÓN DE UI
    // ----------------------------------------------------------------------
    function renderizarInterfaz() {
        const tablaCuerpo = document.getElementById('tablaGastosCuerpo');
        const montoTotalEl = document.getElementById('montoTotal');

        if (!tablaCuerpo) return;

        tablaCuerpo.innerHTML = '';

        let totalIngresos = 0;
        let totalGastos = 0;
        const totalPorCategoria = {};

        transacciones.forEach((item, index) => {
            const monto = parseFloat(item.monto);

            if (item.tipo === 'ingreso') {
                totalIngresos += monto;
            } else {
                totalGastos += monto;
                totalPorCategoria[item.categoria] = (totalPorCategoria[item.categoria] || 0) + monto;
            }

            // Crear fila de la tabla
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.fecha}</td>
                <td><strong>${item.descripcion}</strong></td>
                <td><span class="badge-cat">${item.categoria}</span></td>
                <td style="color: ${item.tipo === 'ingreso' ? '#10b981' : '#ef4444'}; font-weight: bold;">
                    ${item.tipo === 'ingreso' ? '+' : '-'}$${monto.toFixed(2)}
                </td>
                <td>
                    ${item.comprobante 
                        ? `<a href="${item.comprobante}" target="_blank" class="link">📎 Ver File</a>` 
                        : '<span style="color: #94a3b8;">Sin adjunto</span>'}
                </td>
                <td>
                    <button class="btn-danger btn-sm" onclick="eliminarTransaccion(${index})">🗑️ Borrar</button>
                </td>
            `;
            tablaCuerpo.appendChild(tr);
        });

        // Actualizar Monto Total en Tesoro
        const balanceTotal = totalIngresos - totalGastos;
        if (montoTotalEl) {
            montoTotalEl.textContent = `$${balanceTotal.toFixed(2)}`;
            montoTotalEl.style.color = balanceTotal >= 0 ? '#10b981' : '#ef4444';
        }

        // Actualizar Gráficos
        actualizarGraficos(totalPorCategoria, totalIngresos, totalGastos);
    }

    function actualizarGraficos(categoriasObj, ingresos, gastos) {
        if (chartCategoriasInstance) {
            chartCategoriasInstance.data.labels = Object.keys(categoriasObj);
            chartCategoriasInstance.data.datasets[0].data = Object.values(categoriasObj);
            chartCategoriasInstance.update();
        }

        if (chartBalanceInstance) {
            chartBalanceInstance.data.datasets[0].data = [ingresos, gastos];
            chartBalanceInstance.update();
        }
    }

    // ----------------------------------------------------------------------
    // 6. MANEJO DE FORMULARIO (NUEVO MOVIMIENTO)
    // ----------------------------------------------------------------------
    const formGasto = document.getElementById('formGasto');

    if (formGasto) {
        formGasto.addEventListener('submit', (e) => {
            e.preventDefault();

            const descripcion = document.getElementById('descripcion').value.trim();
            const monto = parseFloat(document.getElementById('monto').value);
            const tipo = document.getElementById('tipo').value;
            const categoria = document.getElementById('categoria').value;
            const comprobanteInput = document.getElementById('comprobante');

            if (!descripcion || isNaN(monto) || !categoria) {
                alert('Por favor, completa todos los campos requeridos.');
                return;
            }

            const procesarYGuardar = (comprobanteUrl = null) => {
                const nuevaTransaccion = {
                    id: Date.now(),
                    fecha: new Date().toLocaleDateString('es-AR'),
                    descripcion,
                    monto,
                    tipo,
                    categoria,
                    comprobante: comprobanteUrl
                };

                transacciones.unshift(nuevaTransaccion);
                guardarEnStorage();
                renderizarInterfaz();
                formGasto.reset();
            };

            // Lectura del archivo comprobante
            if (comprobanteInput && comprobanteInput.files.length > 0) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    procesarYGuardar(event.target.result);
                };
                reader.readAsDataURL(comprobanteInput.files[0]);
            } else {
                procesarYGuardar();
            }
        });
    }

    // Funcionalidad Global para eliminar
    window.eliminarTransaccion = function (index) {
        if (confirm('¿Deseas borrar esta anotación de la bitácora?')) {
            transacciones.splice(index, 1);
            guardarEnStorage();
            renderizarInterfaz();
        }
    };

    // Inicialización al cargar la página
    inicializarGraficos();
    renderizarInterfaz();
});