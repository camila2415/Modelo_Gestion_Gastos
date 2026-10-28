/* ==========================================================================
   MÓDULO PRINCIPAL DE GESTIÓN DE GASTOS (SGG - GRAND LINE)
   Persistencia Relacional Obligatoria: SQLite + WebAssembly (sql.js) + OPFS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {

    // ----------------------------------------------------------------------
    // 0. USUARIO ACTIVO Y CONFIGURACIÓN INICIAL DE FECHA
    // ----------------------------------------------------------------------
    const usuarioActivo = localStorage.getItem('sgg_usuario_activo') || 'cami1524@gmail.com';
    const userDisplay = document.getElementById('userEmailDisplay');
    if (userDisplay) {
        userDisplay.textContent = usuarioActivo;
    }

    // Setear la fecha de hoy por defecto en el input date
    const inputFecha = document.getElementById('fecha');
    if (inputFecha) {
        inputFecha.valueAsDate = new Date();
    }

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
            inicializarGraficos(); // Redibuja los gráficos ajustando colores
        });
    }

    // ----------------------------------------------------------------------
    // 2. CONTROL DE SESIÓN DE USUARIO
    // ----------------------------------------------------------------------
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas desembarcar del puerto?')) {
                localStorage.removeItem('sgg_usuario_activo');
                window.location.href = 'index.html';
            }
        });
    }

    // ----------------------------------------------------------------------
    // 3. BASE DE DATOS SQLITE + OPFS
    // ----------------------------------------------------------------------
    let db = null;
    let transacciones = [];
    const DB_NAME = 'gastos.sqlite';

    async function initSQLite() {
        try {
            const SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });

            const opfsRoot = await navigator.storage.getDirectory();
            let arrayBuffer = null;

            try {
                const fileHandle = await opfsRoot.getFileHandle(DB_NAME);
                const file = await fileHandle.getFile();
                arrayBuffer = await file.arrayBuffer();
                db = new SQL.Database(new Uint8Array(arrayBuffer));
            } catch (e) {
                db = new SQL.Database();
            }

            // DDL de la tabla
            db.run(`
                CREATE TABLE IF NOT EXISTS transacciones (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fecha TEXT NOT NULL,
                    descripcion TEXT NOT NULL,
                    monto REAL NOT NULL,
                    tipo TEXT NOT NULL,
                    categoria TEXT NOT NULL,
                    comprobante TEXT
                );
            `);

            await guardarEnOPFS();
            await cargarTransaccionesSQL();
        } catch (err) {
            console.error("Error al inicializar SQLite en OPFS:", err);
        }
    }

    async function guardarEnOPFS() {
        if (!db) return;
        const binaryData = db.export();
        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(DB_NAME, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(binaryData);
        await writable.close();
    }

    async function cargarTransaccionesSQL() {
        if (!db) return;
        const stmt = db.prepare("SELECT * FROM transacciones ORDER BY id DESC");
        transacciones = [];

        while (stmt.step()) {
            transacciones.push(stmt.getAsObject());
        }
        stmt.free();
        renderizarInterfaz();
    }

    async function guardarTransaccionSQL(fecha, descripcion, monto, tipo, categoria, comprobanteUrl) {
        if (!db) return;

        db.run(
            `INSERT INTO transacciones (fecha, descripcion, monto, tipo, categoria, comprobante) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [fecha, descripcion, monto, tipo, categoria, comprobanteUrl]
        );

        await guardarEnOPFS();
        await cargarTransaccionesSQL();
    }

    // Función de eliminación con Modal o Alerta nativa
    window.eliminarTransaccion = async function (id) {
        const modal = document.getElementById('modalConfirmar');
        const btnAceptar = document.getElementById('btnAceptarEliminar');
        const btnCancelar = document.getElementById('btnCancelarEliminar');

        if (modal && btnAceptar && btnCancelar) {
            modal.style.display = 'flex';

            const confirmar = async () => {
                db.run("DELETE FROM transacciones WHERE id = ?", [id]);
                await guardarEnOPFS();
                await cargarTransaccionesSQL();
                modal.style.display = 'none';
                limpiarListeners();
            };

            const cancelar = () => {
                modal.style.display = 'none';
                limpiarListeners();
            };

            function limpiarListeners() {
                btnAceptar.removeEventListener('click', confirmar);
                btnCancelar.removeEventListener('click', cancelar);
            }

            btnAceptar.addEventListener('click', confirmar);
            btnCancelar.addEventListener('click', cancelar);
        } else {
            if (confirm('¿Deseas borrar esta anotación de la bitácora?')) {
                db.run("DELETE FROM transacciones WHERE id = ?", [id]);
                await guardarEnOPFS();
                await cargarTransaccionesSQL();
            }
        }
    };

    let chartCategoriasInstance = null;
    let chartBalanceInstance = null;

    function inicializarGraficos() {
        const ctxDona = document.getElementById('chartDona');
        const ctxBarras = document.getElementById('chartBarras');

        if (!ctxDona || !ctxBarras) return;

        const esOscuro = document.body.classList.contains('dark-mode');
        const colorTexto = esOscuro ? '#f8fafc' : '#1e293b';

        if (chartCategoriasInstance) chartCategoriasInstance.destroy();
        if (chartBalanceInstance) chartBalanceInstance.destroy();

        // 1. Gráfico de Categorías (Dona)
        chartCategoriasInstance = new Chart(ctxDona, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'],
                    borderWidth: 2,
                    borderColor: esOscuro ? '#0f172a' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%', // ACHICA EL ANCHO DE LA DONA PARA IGUALAR TAMAÑOS
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { color: colorTexto, padding: 12 } 
                    }
                }
            }
        });

        // 2. Gráfico Balance Ingresos vs Egresos (Barras)
        chartBalanceInstance = new Chart(ctxBarras, {
            type: 'bar',
            data: {
                labels: ['Ingresos (Botín)', 'Egresos (Gastos)'],
                datasets: [{
                    label: 'Monto Total ($)',
                    data: [0, 0],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { color: colorTexto },
                        grid: { color: esOscuro ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
                    },
                    x: { ticks: { color: colorTexto }, grid: { display: false } }
                }
            }
        });
    }

    // ----------------------------------------------------------------------
    // 5. RENDERING Y ACTUALIZACIÓN DE UI DE TU HTML
    // ----------------------------------------------------------------------
    function renderizarInterfaz() {
        const tablaCuerpo = document.getElementById('tablaGastosBody');
        const totalGastadoEl = document.getElementById('totalGastado');

        if (!tablaCuerpo) return;

        tablaCuerpo.innerHTML = '';

        let totalIngresos = 0;
        let totalGastos = 0;
        const totalPorCategoria = {};

        transacciones.forEach((item) => {
            const monto = parseFloat(item.monto);

            if (item.tipo === 'ingreso') {
                totalIngresos += monto;
            } else {
                totalGastos += monto;
                totalPorCategoria[item.categoria] = (totalPorCategoria[item.categoria] || 0) + monto;
            }

            // Formatear la fecha para mostrarla amigable
            const fechaFormateada = item.fecha.includes('-') 
                ? item.fecha.split('-').reverse().join('/') 
                : item.fecha;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${fechaFormateada}</td>
                <td><span style="color: ${item.tipo === 'ingreso' ? '#10b981' : '#ef4444'}; font-weight: bold;">
                    ${item.tipo === 'ingreso' ? '🟢 Ingreso' : '🔴 Egreso'}
                </span></td>
                <td><span class="badge-cat">${item.categoria}</span></td>
                <td><strong>${item.descripcion}</strong></td>
                <td style="color: ${item.tipo === 'ingreso' ? '#10b981' : '#ef4444'}; font-weight: bold;">
                    ${item.tipo === 'ingreso' ? '+' : '-'}$${monto.toFixed(2)}
                </td>
                <td>
                    ${item.comprobante 
                        ? `<a href="${item.comprobante}" target="_blank" class="link">📎 Ver Ticket</a>` 
                        : '<span style="color: #94a3b8;">Sin adjunto</span>'}
                </td>
                <td>
                    <button class="btn-delete btn-sm" onclick="eliminarTransaccion(${item.id})">🗑️ Borrar</button>
                </td>
            `;
            tablaCuerpo.appendChild(tr);
        });

        // Actualizar el "Botín Acumulado" (Balance Total)
        const balanceTotal = totalIngresos - totalGastos;
        if (totalGastadoEl) {
            totalGastadoEl.textContent = balanceTotal.toFixed(2);
            totalGastadoEl.parentElement.style.color = balanceTotal >= 0 ? '#10b981' : '#ef4444';
        }

        // Actualizar Gráficos
        if (chartCategoriasInstance && chartBalanceInstance) {
            chartCategoriasInstance.data.labels = Object.keys(totalPorCategoria);
            chartCategoriasInstance.data.datasets[0].data = Object.values(totalPorCategoria);
            chartCategoriasInstance.update();

            chartBalanceInstance.data.datasets[0].data = [totalIngresos, totalGastos];
            chartBalanceInstance.update();
        }
    }

    // ----------------------------------------------------------------------
    // 6. MANEJO DE FORMULARIO DE TU HTML
    // ----------------------------------------------------------------------
    const formGasto = document.getElementById('formGasto');

    if (formGasto) {
        formGasto.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Mapeo directo a los IDs exactos de tu HTML
            const inputTipo = document.getElementById('tipoMovimiento');
            const inputMonto = document.getElementById('monto');
            const inputCat = document.getElementById('categoria');
            const inputFecha = document.getElementById('fecha');
            const inputDesc = document.getElementById('descripcion');
            const inputComp = document.getElementById('comprobanteFile');

            const tipo = inputTipo ? inputTipo.value : 'egreso';
            const monto = inputMonto ? parseFloat(inputMonto.value) : NaN;
            const categoria = inputCat ? inputCat.value : 'Varios';
            const fecha = inputFecha ? inputFecha.value : new Date().toISOString().split('T')[0];
            const descripcion = inputDesc ? inputDesc.value.trim() : '';

            if (!descripcion || isNaN(monto) || monto <= 0 || !categoria) {
                alert('Por favor, ingresa una descripción, un monto válido y selecciona una categoría.');
                return;
            }

            const procesarYGuardar = async (comprobanteUrl = null) => {
                await guardarTransaccionSQL(fecha, descripcion, monto, tipo, categoria, comprobanteUrl);
                formGasto.reset();
                if (inputFecha) inputFecha.valueAsDate = new Date(); // Resetear con la fecha de hoy
            };

            if (inputComp && inputComp.files && inputComp.files.length > 0) {
                const reader = new FileReader();
                reader.onload = async function (event) {
                    await procesarYGuardar(event.target.result);
                };
                reader.readAsDataURL(inputComp.files[0]);
            } else {
                await procesarYGuardar();
            }
        });
    }

    // Inicialización general
    inicializarGraficos();
    await initSQLite();
});