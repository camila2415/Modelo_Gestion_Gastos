/* ==========================================================================
   MÓDULO DE GASTOS CON PERSISTENCIA OBLIGATORIA EN SQLITE + OPFS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    
    // ----------------------------------------------------------------------
    // 1. CONTROL DE TEMA (MODO SOL / NOCHE)
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
    // 2. CONTROL DE SESIÓN
    // ----------------------------------------------------------------------
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas desembarcar del puerto?')) {
                window.location.href = 'index.html';
            }
        });
    }

    // ----------------------------------------------------------------------
    // 3. MOTOR SQLITE + OPFS (REQUISITO OBLIGATORIO)
    // ----------------------------------------------------------------------
    let db = null;
    let transacciones = [];
    const DB_NAME = 'gastos.sqlite';

    // Inicialización del motor SQLite con WebAssembly y almacenamiento OPFS
    async function initSQLite() {
        try {
            const SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });

            // Acceso directo al disco con Origin Private File System (OPFS)
            const opfsRoot = await navigator.storage.getDirectory();
            let arrayBuffer = null;

            try {
                const fileHandle = await opfsRoot.getFileHandle(DB_NAME);
                const file = await fileHandle.getFile();
                arrayBuffer = await file.arrayBuffer();
                db = new SQL.Database(new Uint8Array(arrayBuffer));
            } catch (e) {
                // Si el archivo .sqlite no existe aún en OPFS, creamos la BD vacía
                db = new SQL.Database();
            }

            // Crear tabla con consulta SQL estándar
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
            console.error("Error al iniciar SQLite en OPFS:", err);
        }
    }

    // Guardar el binario .sqlite físicamente en disco (OPFS)
    async function guardarEnOPFS() {
        if (!db) return;
        const binaryData = db.export();
        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(DB_NAME, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(binaryData);
        await writable.close();
    }

    // CONSULTA SQL SELECT: Leer registros de la base de datos
    async function cargarTransaccionesSQL() {
        const stmt = db.prepare("SELECT * FROM transacciones ORDER BY id DESC");
        transacciones = [];

        while (stmt.step()) {
            transacciones.push(stmt.getAsObject());
        }
        stmt.free();
        renderizarInterfaz();
    }

    // CONSULTA SQL INSERT: Agregar registro
    async function guardarTransaccionSQL(descripcion, monto, tipo, categoria, comprobanteUrl) {
        const fecha = new Date().toLocaleDateString('es-AR');

        db.run(
            `INSERT INTO transacciones (fecha, descripcion, monto, tipo, categoria, comprobante) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [fecha, descripcion, monto, tipo, categoria, comprobanteUrl]
        );

        await guardarEnOPFS();
        await cargarTransaccionesSQL();
    }

    // CONSULTA SQL DELETE: Eliminar registro por ID
    window.eliminarTransaccionSQL = async function(id) {
        if (confirm('¿Deseas borrar esta anotación de la bitácora?')) {
            db.run("DELETE FROM transacciones WHERE id = ?", [id]);
            await guardarEnOPFS();
            await cargarTransaccionesSQL();
        }
    };

    // ----------------------------------------------------------------------
    // 4. GRÁFICOS (Chart.js)
    // ----------------------------------------------------------------------
    let chartCategoriasInstance = null;
    let chartBalanceInstance = null;

    function inicializarGraficos() {
        const ctxCat = document.getElementById('chartCategorias');
        const ctxBal = document.getElementById('chartBalance');

        if (!ctxCat || !ctxBal) return;

        chartCategoriasInstance = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'],
                    borderWidth: 2
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });

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
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    // ----------------------------------------------------------------------
    // 5. INTERFAZ DE USUARIO Y TABLA
    // ----------------------------------------------------------------------
    function renderizarInterfaz() {
        const tablaCuerpo = document.getElementById('tablaGastosCuerpo');
        const montoTotalEl = document.getElementById('montoTotal');

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
                    <button class="btn-danger btn-sm" onclick="eliminarTransaccionSQL(${item.id})">🗑️ Borrar</button>
                </td>
            `;
            tablaCuerpo.appendChild(tr);
        });

        const balanceTotal = totalIngresos - totalGastos;
        if (montoTotalEl) {
            montoTotalEl.textContent = `$${balanceTotal.toFixed(2)}`;
            montoTotalEl.style.color = balanceTotal >= 0 ? '#10b981' : '#ef4444';
        }

        if (chartCategoriasInstance && chartBalanceInstance) {
            chartCategoriasInstance.data.labels = Object.keys(totalPorCategoria);
            chartCategoriasInstance.data.datasets[0].data = Object.values(totalPorCategoria);
            chartCategoriasInstance.update();

            chartBalanceInstance.data.datasets[0].data = [totalIngresos, totalGastos];
            chartBalanceInstance.update();
        }
    }

    // ----------------------------------------------------------------------
    // 6. FORMULARIO
    // ----------------------------------------------------------------------
    const formGasto = document.getElementById('formGasto');

    if (formGasto) {
        formGasto.addEventListener('submit', async (e) => {
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

            const procesarFormulario = async (comprobanteUrl = null) => {
                await guardarTransaccionSQL(descripcion, monto, tipo, categoria, comprobanteUrl);
                formGasto.reset();
            };

            if (comprobanteInput && comprobanteInput.files.length > 0) {
                const reader = new FileReader();
                reader.onload = async function (event) {
                    await procesarFormulario(event.target.result);
                };
                reader.readAsDataURL(comprobanteInput.files[0]);
            } else {
                await procesarFormulario();
            }
        });
    }

    // Inicializar SQLite y Gráficos
    inicializarGraficos();
    await initSQLite();
});