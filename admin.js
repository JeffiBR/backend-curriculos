// Configuração do Supabase
const SUPABASE_URL = 'SUA_URL_DO_SUPABASE';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_DO_SUPABASE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variáveis globais
let currentCandidatura = null;
let currentPage = 1;
let itemsPerPage = 10;
let totalCandidaturas = 0;
let allCandidaturas = [];
let filteredCandidaturas = [];
let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let candidaturasChart = null;
let vagasChart = null;
let cidadesChart = null;

// Elementos DOM
const elements = {
    // Navegação
    navBtns: document.querySelectorAll('.nav-btn'),
    contentSections: document.querySelectorAll('.content-section'),
    
    // Dashboard
    totalCandidaturas: document.getElementById('total-candidaturas'),
    candidaturasHoje: document.getElementById('candidaturas-hoje'),
    vagaPopular: document.getElementById('vaga-popular'),
    cidadeTop: document.getElementById('cidade-top'),
    topDayDate: document.getElementById('top-day-date'),
    topDayCount: document.getElementById('top-day-count'),
    
    // Candidaturas
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    filterVaga: document.getElementById('filter-vaga'),
    filterData: document.getElementById('filter-data'),
    filterEstado: document.getElementById('filter-estado'),
    filterExperiencia: document.getElementById('filter-experiencia'),
    clearFilters: document.getElementById('clear-filters'),
    candidaturasList: document.getElementById('candidaturas-list'),
    pagination: document.getElementById('pagination'),
    loadingIndicator: document.getElementById('loading-indicator'),
    
    // Vagas
    vagasList: document.getElementById('vagas-list'),
    addVagaBtn: document.getElementById('add-vaga-btn'),
    vagaModal: document.getElementById('vaga-modal'),
    vagaForm: document.getElementById('vaga-form'),
    saveVagaBtn: document.getElementById('save-vaga-btn'),
    cancelVagaBtn: document.getElementById('cancel-vaga-btn'),
    vagaModalTitle: document.getElementById('vaga-modal-title'),
    vagaIdInput: document.getElementById('vaga-id'),
    vagaTituloInput: document.getElementById('vaga-titulo'),
    vagaSlugInput: document.getElementById('vaga-slug'),
    vagaDescricaoInput: document.getElementById('vaga-descricao'),
    vagaAtivaInput: document.getElementById('vaga-ativa'),
    
    // Busca Avançada
    keywordInput: document.getElementById('keyword-input'),
    skillInput: document.getElementById('skill-input'),
    experienceFilter: document.getElementById('experience-filter'),
    searchKeywordBtn: document.getElementById('search-keyword-btn'),
    keywordResults: document.getElementById('keyword-results'),
    
    // Modais
    detailsModal: document.getElementById('details-modal'),
    curriculoModal: document.getElementById('curriculo-modal'),
    confirmModal: document.getElementById('confirm-modal'),
    modalBody: document.getElementById('modal-body'),
    viewCurriculoBtn: document.getElementById('view-curriculo-btn'),
    downloadCurriculoBtn: document.getElementById('download-curriculo-btn'),
    deleteCandidaturaBtn: document.getElementById('delete-candidatura-btn'),
    pdfViewer: document.getElementById('pdf-viewer'),
    docViewer: document.getElementById('doc-viewer'),
    pdfCanvas: document.getElementById('pdf-canvas'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    currentPage: document.getElementById('current-page'),
    totalPages: document.getElementById('total-pages'),
    downloadPdf: document.getElementById('download-pdf'),
    downloadDoc: document.getElementById('download-doc'),
    confirmDelete: document.getElementById('confirm-delete'),
    cancelDelete: document.getElementById('cancel-delete'),
    
    // Tema
    themeBtn: document.getElementById('theme-btn')
};

// Event Listeners
document.addEventListener('DOMContentLoaded', initAdmin);

// Navegação
elements.navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const target = e.target.getAttribute('data-target');
        switchSection(target);
    });
});

// Dashboard - já carregado automaticamente

// Candidaturas
elements.searchBtn.addEventListener('click', applyFilters);
elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyFilters();
});
elements.filterVaga.addEventListener('change', applyFilters);
elements.filterData.addEventListener('change', applyFilters);
elements.filterEstado.addEventListener('input', applyFilters);
elements.filterExperiencia.addEventListener('change', applyFilters);
elements.clearFilters.addEventListener('click', clearAllFilters);

// Vagas
elements.addVagaBtn.addEventListener('click', () => openVagaModal());
elements.saveVagaBtn.addEventListener('click', saveVaga);
elements.cancelVagaBtn.addEventListener('click', () => elements.vagaModal.classList.add('hidden'));

// Busca Avançada
elements.searchKeywordBtn.addEventListener('click', searchByKeyword);

// Modais
elements.viewCurriculoBtn.addEventListener('click', viewCurriculo);
elements.downloadCurriculoBtn.addEventListener('click', downloadCurriculo);
elements.deleteCandidaturaBtn.addEventListener('click', showConfirmDelete);
elements.confirmDelete.addEventListener('click', deleteCandidatura);
elements.cancelDelete.addEventListener('click', closeConfirmModal);
elements.prevPage.addEventListener('click', showPrevPage);
elements.nextPage.addEventListener('click', showNextPage);
elements.downloadPdf.addEventListener('click', downloadCurriculo);
elements.downloadDoc.addEventListener('click', downloadCurriculo);

// Tema
elements.themeBtn.addEventListener('click', toggleTheme);

// Fechar modais
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        modal.classList.add('hidden');
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});

// Inicialização
async function initAdmin() {
    applySavedTheme();
    await loadVagasForFilter();
    await loadDashboardData();
    await loadCandidaturas();
    setupPagination();
}

// Tema
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem('admin-theme', newTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    elements.themeBtn.textContent = theme === 'light' ? '🌙 Modo Escuro' : '☀️ Modo Claro';
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('admin-theme') || 'light';
    applyTheme(savedTheme);
}

// Navegação entre seções
function switchSection(sectionName) {
    // Atualizar botões de navegação
    elements.navBtns.forEach(btn => {
        if (btn.getAttribute('data-target') === sectionName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Mostrar seção ativa
    elements.contentSections.forEach(section => {
        if (section.id === sectionName) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
    
    // Carregar dados específicos da seção
    if (sectionName === 'dashboard') {
        loadDashboardData();
    } else if (sectionName === 'vagas') {
        loadVagas();
    }
}

// Dashboard
async function loadDashboardData() {
    try {
        // Buscar dados das candidaturas
        const { data: candidaturas, error } = await supabase
            .from('candidaturas')
            .select('*')
            .order('data_envio', { ascending: false });
        
        if (error) throw error;

        // Estatísticas básicas
        elements.totalCandidaturas.textContent = candidaturas.length;

        // Candidaturas de hoje
        const hoje = new Date().toISOString().split('T')[0];
        const candidaturasHoje = candidaturas.filter(c => 
            c.data_envio.split('T')[0] === hoje
        );
        elements.candidaturasHoje.textContent = candidaturasHoje.length;

        // Vaga mais popular
        const vagasCount = {};
        candidaturas.forEach(c => {
            vagasCount[c.vaga] = (vagasCount[c.vaga] || 0) + 1;
        });
        const vagaPopular = Object.entries(vagasCount).sort((a, b) => b[1] - a[1])[0];
        elements.vagaPopular.textContent = vagaPopular ? `${formatVaga(vagaPopular[0])} (${vagaPopular[1]})` : '-';

        // Cidade top
        const cidadesCount = {};
        candidaturas.forEach(c => {
            cidadesCount[c.cidade] = (cidadesCount[c.cidade] || 0) + 1;
        });
        const cidadeTop = Object.entries(cidadesCount).sort((a, b) => b[1] - a[1])[0];
        elements.cidadeTop.textContent = cidadeTop ? `${cidadeTop[0]} (${cidadeTop[1]})` : '-';

        // Dia com mais candidaturas
        const diasCount = {};
        candidaturas.forEach(c => {
            const dia = c.data_envio.split('T')[0];
            diasCount[dia] = (diasCount[dia] || 0) + 1;
        });
        const topDay = Object.entries(diasCount).sort((a, b) => b[1] - a[1])[0];
        if (topDay) {
            elements.topDayDate.textContent = new Date(topDay[0]).toLocaleDateString('pt-BR');
            elements.topDayCount.textContent = `${topDay[1]} candidaturas`;
        }

        // Gráficos
        createCandidaturasChart(candidaturas);
        createVagasChart(vagasCount);
        createCidadesChart(cidadesCount);

    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

function createCandidaturasChart(candidaturas) {
    const ctx = document.getElementById('candidaturasChart').getContext('2d');
    
    // Últimos 7 dias
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }
    
    const candidaturasPorDia = last7Days.map(dia => {
        return candidaturas.filter(c => c.data_envio.split('T')[0] === dia).length;
    });
    
    if (candidaturasChart) {
        candidaturasChart.destroy();
    }
    
    candidaturasChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(dia => new Date(dia).toLocaleDateString('pt-BR')),
            datasets: [{
                label: 'Candidaturas',
                data: candidaturasPorDia,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function createVagasChart(vagasCount) {
    const ctx = document.getElementById('vagasChart').getContext('2d');
    
    const topVagas = Object.entries(vagasCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    if (vagasChart) {
        vagasChart.destroy();
    }
    
    vagasChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topVagas.map(v => formatVaga(v[0])),
            datasets: [{
                label: 'Candidaturas',
                data: topVagas.map(v => v[1]),
                backgroundColor: '#4CAF50',
                borderColor: '#388E3C',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function createCidadesChart(cidadesCount) {
    const ctx = document.getElementById('cidadesChart').getContext('2d');
    
    const topCidades = Object.entries(cidadesCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    if (cidadesChart) {
        cidadesChart.destroy();
    }
    
    cidadesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: topCidades.map(c => c[0]),
            datasets: [{
                data: topCidades.map(c => c[1]),
                backgroundColor: [
                    '#4CAF50',
                    '#2196F3',
                    '#FF9800',
                    '#F44336',
                    '#9C27B0'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Carregar Candidaturas
async function loadCandidaturas() {
    showLoading(true);
    
    try {
        const { data, error, count } = await supabase
            .from('candidaturas')
            .select('*', { count: 'exact' })
            .order('data_envio', { ascending: false });
        
        if (error) throw error;
        
        allCandidaturas = data || [];
        filteredCandidaturas = [...allCandidaturas];
        totalCandidaturas = count || 0;
        
        renderCandidaturas();
        setupPagination();
    } catch (error) {
        console.error('Erro ao carregar candidaturas:', error);
        alert('Erro ao carregar candidaturas.');
    } finally {
        showLoading(false);
    }
}

// Filtros
async function loadVagasForFilter() {
    try {
        const { data: vagas, error } = await supabase
            .from('vagas')
            .select('*')
            .eq('ativa', true);
        
        if (error) throw error;
        
        elements.filterVaga.innerHTML = '<option value="">Todas as Vagas</option>';
        vagas.forEach(vaga => {
            const option = document.createElement('option');
            option.value = vaga.slug;
            option.textContent = vaga.titulo;
            elements.filterVaga.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar vagas para filtro:', error);
    }
}

function applyFilters() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const vagaFilter = elements.filterVaga.value;
    const dataFilter = elements.filterData.value;
    const estadoFilter = elements.filterEstado.value.toLowerCase();
    const experienciaFilter = elements.filterExperiencia.value;
    
    filteredCandidaturas = allCandidaturas.filter(candidatura => {
        const matchesSearch = !searchTerm || 
            candidatura.nome.toLowerCase().includes(searchTerm) ||
            candidatura.cpf.includes(searchTerm) ||
            candidatura.vaga.toLowerCase().includes(searchTerm);
        
        const matchesVaga = !vagaFilter || candidatura.vaga === vagaFilter;
        
        const matchesData = !dataFilter || 
            candidatura.data_envio.split('T')[0] === dataFilter;
        
        const matchesEstado = !estadoFilter || 
            candidatura.estado.toLowerCase().includes(estadoFilter);
        
        const matchesExperiencia = !experienciaFilter || 
            checkExperiencia(candidatura, experienciaFilter);
        
        return matchesSearch && matchesVaga && matchesData && matchesEstado && matchesExperiencia;
    });
    
    currentPage = 1;
    renderCandidaturas();
    setupPagination();
}

function checkExperiencia(candidatura, filter) {
    if (!candidatura.experiencia_extraida) return false;
    
    const exp = candidatura.experiencia_extraida;
    const totalAnos = exp.total_anos_experiencia || 0;
    
    switch(filter) {
        case '1-2':
            return totalAnos >= 1 && totalAnos <= 2;
        case '3-5':
            return totalAnos >= 3 && totalAnos <= 5;
        case '5+':
            return totalAnos >= 5;
        default:
            return true;
    }
}

function clearAllFilters() {
    elements.searchInput.value = '';
    elements.filterVaga.value = '';
    elements.filterData.value = '';
    elements.filterEstado.value = '';
    elements.filterExperiencia.value = '';
    applyFilters();
}

// Renderização
function renderCandidaturas() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageCandidaturas = filteredCandidaturas.slice(startIndex, endIndex);
    
    if (pageCandidaturas.length === 0) {
        elements.candidaturasList.innerHTML = `
            <div class="no-results">
                <p>Nenhuma candidatura encontrada com os filtros aplicados.</p>
            </div>
        `;
        return;
    }
    
    elements.candidaturasList.innerHTML = pageCandidaturas.map(candidatura => `
        <div class="candidatura-item" data-id="${candidatura.id}">
            <div class="candidatura-header">
                <div class="candidatura-nome">${candidatura.nome}</div>
                <div class="candidatura-vaga">${formatVaga(candidatura.vaga)}</div>
            </div>
            <div class="candidatura-info">
                <div>
                    <span class="info-label">CPF:</span> ${candidatura.cpf}
                </div>
                <div>
                    <span class="info-label">Telefone:</span> ${candidatura.telefone}
                </div>
                <div>
                    <span class="info-label">Localidade:</span> ${candidatura.cidade}/${candidatura.estado}
                </div>
                <div>
                    <span class="info-label">Data:</span> ${new Date(candidatura.data_envio).toLocaleDateString('pt-BR')}
                </div>
                ${candidatura.experiencia_extraida ? `
                <div>
                    <span class="info-label">Experiência:</span> 
                    <span class="experiencia-tag">
                        ${candidatura.experiencia_extraida.total_anos_experiencia || 'N/A'} anos
                    </span>
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    // Adicionar event listeners aos itens
    document.querySelectorAll('.candidatura-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.getAttribute('data-id'));
            showCandidaturaDetails(id);
        });
    });
}

function formatVaga(vaga) {
    const vagas = {
        'desenvolvedor-frontend': 'Frontend',
        'desenvolvedor-backend': 'Backend',
        'analista-dados': 'Analista Dados',
        'designer-ui-ux': 'Designer UI/UX',
        'gerente-projetos': 'Gerente Projetos'
    };
    return vagas[vaga] || vaga;
}

// Paginação
function setupPagination() {
    const totalPages = Math.ceil(filteredCandidaturas.length / itemsPerPage);
    
    if (totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Botão anterior
    paginationHTML += `<button ${currentPage === 1 ? 'disabled' : ''} id="prev-page-btn">‹ Anterior</button>`;
    
    // Páginas
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    // Botão próximo
    paginationHTML += `<button ${currentPage === totalPages ? 'disabled' : ''} id="next-page-btn">Próxima ›</button>`;
    
    elements.pagination.innerHTML = paginationHTML;
    
    // Event listeners
    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderCandidaturas();
            setupPagination();
        }
    });
    
    document.getElementById('next-page-btn')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderCandidaturas();
            setupPagination();
        }
    });
    
    document.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.getAttribute('data-page'));
            renderCandidaturas();
            setupPagination();
        });
    });
}

// Detalhes da Candidatura
function showCandidaturaDetails(id) {
    currentCandidatura = filteredCandidaturas.find(c => c.id === id);
    
    if (!currentCandidatura) return;
    
    let experienciaHTML = '';
    if (currentCandidatura.experiencia_extraida) {
        const exp = currentCandidatura.experiencia_extraida;
        experienciaHTML = `
            <div class="experiencia-info">
                <h4>Experiência Extraída do Currículo</h4>
                <div class="experiencia-item">
                    <strong>Total de Experiência:</strong> ${exp.total_anos_experiencia || 'N/A'} anos
                </div>
                ${exp.competencias ? `
                <div class="experiencia-item">
                    <strong>Competências:</strong> ${exp.competencias.join(', ')}
                </div>
                ` : ''}
                ${exp.empresas ? `
                <div class="experiencia-item">
                    <strong>Empresas:</strong> ${exp.empresas.join(', ')}
                </div>
                ` : ''}
            </div>
        `;
    }
    
    elements.modalBody.innerHTML = `
        <div class="details-grid">
            <div class="detail-item">
                <div class="detail-label">Nome Completo</div>
                <div class="detail-value">${currentCandidatura.nome}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">CPF</div>
                <div class="detail-value">${currentCandidatura.cpf}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Telefone</div>
                <div class="detail-value">${currentCandidatura.telefone}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Vaga</div>
                <div class="detail-value">${formatVaga(currentCandidatura.vaga)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Endereço</div>
                <div class="detail-value">
                    ${currentCandidatura.rua}, ${currentCandidatura.numero || 'S/N'}<br>
                    ${currentCandidatura.bairro}<br>
                    ${currentCandidatura.cidade} - ${currentCandidatura.estado}<br>
                    CEP: ${currentCandidatura.cep}
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Data de Envio</div>
                <div class="detail-value">${new Date(currentCandidatura.data_envio).toLocaleString('pt-BR')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Arquivo do Currículo</div>
                <div class="detail-value">${currentCandidatura.arquivo_curriculo}</div>
            </div>
        </div>
        ${experienciaHTML}
    `;
    
    elements.detailsModal.classList.remove('hidden');
}

// Gerenciamento de Vagas
async function loadVagas() {
    try {
        const { data: vagas, error } = await supabase
            .from('vagas')
            .select('*')
            .order('data_criacao', { ascending: false });
        
        if (error) throw error;
        
        renderVagas(vagas);
    } catch (error) {
        console.error('Erro ao carregar vagas:', error);
        alert('Erro ao carregar vagas.');
    }
}

function renderVagas(vagas) {
    if (vagas.length === 0) {
        elements.vagasList.innerHTML = '<p>Nenhuma vaga cadastrada.</p>';
        return;
    }
    
    elements.vagasList.innerHTML = vagas.map(vaga => `
        <div class="vaga-item">
            <div class="vaga-info">
                <h3>${vaga.titulo}</h3>
                <p><strong>Slug:</strong> ${vaga.slug}</p>
                ${vaga.descricao ? `<p>${vaga.descricao}</p>` : ''}
                <span class="vaga-status ${vaga.ativa ? 'vaga-ativa' : 'vaga-inativa'}">
                    ${vaga.ativa ? 'Ativa' : 'Inativa'}
                </span>
            </div>
            <div class="vaga-actions">
                <button class="btn-secondary" onclick="editVaga(${vaga.id})">Editar</button>
                <button class="btn-danger" onclick="deleteVaga(${vaga.id})">Excluir</button>
            </div>
        </div>
    `).join('');
}

function openVagaModal(vaga = null) {
    if (vaga) {
        elements.vagaModalTitle.textContent = 'Editar Vaga';
        elements.vagaIdInput.value = vaga.id;
        elements.vagaTituloInput.value = vaga.titulo;
        elements.vagaSlugInput.value = vaga.slug;
        elements.vagaDescricaoInput.value = vaga.descricao || '';
        elements.vagaAtivaInput.checked = vaga.ativa;
    } else {
        elements.vagaModalTitle.textContent = 'Nova Vaga';
        elements.vagaForm.reset();
        elements.vagaIdInput.value = '';
        elements.vagaAtivaInput.checked = true;
    }
    
    elements.vagaModal.classList.remove('hidden');
}

async function saveVaga() {
    const vagaData = {
        titulo: elements.vagaTituloInput.value,
        slug: elements.vagaSlugInput.value,
        descricao: elements.vagaDescricaoInput.value,
        ativa: elements.vagaAtivaInput.checked
    };
    
    if (!vagaData.titulo || !vagaData.slug) {
        alert('Preencha todos os campos obrigatórios.');
        return;
    }
    
    const vagaId = elements.vagaIdInput.value;
    
    try {
        let error;
        if (vagaId) {
            // Atualizar vaga existente
            const { error: updateError } = await supabase
                .from('vagas')
                .update(vagaData)
                .eq('id', vagaId);
            error = updateError;
        } else {
            // Criar nova vaga
            const { error: insertError } = await supabase
                .from('vagas')
                .insert([vagaData]);
            error = insertError;
        }
        
        if (error) throw error;
        
        elements.vagaModal.classList.add('hidden');
        await loadVagas();
        await loadVagasForFilter(); // Atualizar filtros
        
    } catch (error) {
        console.error('Erro ao salvar vaga:', error);
        alert('Erro ao salvar vaga. Verifique se o slug já existe.');
    }
}

async function editVaga(id) {
    try {
        const { data: vaga, error } = await supabase
            .from('vagas')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        openVagaModal(vaga);
    } catch (error) {
        console.error('Erro ao carregar vaga:', error);
        alert('Erro ao carregar vaga.');
    }
}

async function deleteVaga(id) {
    if (!confirm('Tem certeza que deseja excluir esta vaga?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('vagas')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadVagas();
        await loadVagasForFilter(); // Atualizar filtros
        
    } catch (error) {
        console.error('Erro ao excluir vaga:', error);
        alert('Erro ao excluir vaga.');
    }
}

// Busca Avançada
async function searchByKeyword() {
    const keyword = elements.keywordInput.value.trim();
    const skill = elements.skillInput.value.trim();
    const experience = elements.experienceFilter.value;
    
    if (!keyword && !skill && !experience) {
        alert('Digite pelo menos um critério de busca.');
        return;
    }
    
    try {
        let query = supabase
            .from('candidaturas')
            .select('*');
        
        // Filtro por palavras-chave no texto do currículo
        if (keyword) {
            // Esta é uma busca simples - em produção, você pode querer usar
            // full-text search do Supabase ou um serviço externo
            const { data: allCandidaturas, error } = await query;
            if (error) throw error;
            
            const results = allCandidaturas.filter(candidatura => {
                if (!candidatura.experiencia_extraida) return false;
                
                const exp = candidatura.experiencia_extraida;
                const textToSearch = [
                    ...(exp.competencias || []),
                    ...(exp.empresas || []),
                    exp.total_anos_experiencia?.toString() || ''
                ].join(' ').toLowerCase();
                
                return textToSearch.includes(keyword.toLowerCase());
            });
            
            renderKeywordResults(results);
        } else {
            // Outros filtros podem ser implementados aqui
            const { data: results, error } = await query;
            if (error) throw error;
            
            const filtered = results.filter(candidatura => {
                if (skill && candidatura.experiencia_extraida?.competencias) {
                    return candidatura.experiencia_extraida.competencias
                        .some(comp => comp.toLowerCase().includes(skill.toLowerCase()));
                }
                
                if (experience && candidatura.experiencia_extraida?.total_anos_experiencia) {
                    const anos = candidatura.experiencia_extraida.total_anos_experiencia;
                    switch(experience) {
                        case '1': return anos >= 1;
                        case '3': return anos >= 3;
                        case '5': return anos >= 5;
                    }
                }
                
                return true;
            });
            
            renderKeywordResults(filtered);
        }
        
    } catch (error) {
        console.error('Erro na busca:', error);
        alert('Erro na busca.');
    }
}

function renderKeywordResults(results) {
    if (results.length === 0) {
        elements.keywordResults.innerHTML = '<p>Nenhum resultado encontrado.</p>';
        return;
    }
    
    elements.keywordResults.innerHTML = results.map(candidatura => `
        <div class="candidatura-item" data-id="${candidatura.id}">
            <div class="candidatura-header">
                <div class="candidatura-nome">${candidatura.nome}</div>
                <div class="candidatura-vaga">${formatVaga(candidatura.vaga)}</div>
            </div>
            <div class="candidatura-info">
                <div>
                    <span class="info-label">CPF:</span> ${candidatura.cpf}
                </div>
                <div>
                    <span class="info-label">Telefone:</span> ${candidatura.telefone}
                </div>
                <div>
                    <span class="info-label">Localidade:</span> ${candidatura.cidade}/${candidatura.estado}
                </div>
                <div>
                    <span class="info-label">Experiência:</span> 
                    <span class="experiencia-tag">
                        ${candidatura.experiencia_extraida?.total_anos_experiencia || 'N/A'} anos
                    </span>
                </div>
                ${candidatura.experiencia_extraida?.competencias ? `
                <div>
                    <span class="info-label">Competências:</span> 
                    ${candidatura.experiencia_extraida.competencias.slice(0, 3).join(', ')}
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    // Adicionar event listeners aos itens
    document.querySelectorAll('#keyword-results .candidatura-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.getAttribute('data-id'));
            showCandidaturaDetails(id);
        });
    });
}

// Visualização de Currículo (funções existentes)
async function viewCurriculo() {
    if (!currentCandidatura) return;
    
    const fileExtension = currentCandidatura.arquivo_curriculo.split('.').pop().toLowerCase();
    
    if (fileExtension === 'pdf') {
        await viewPdf();
    } else {
        viewDoc();
    }
}

async function viewPdf() {
    try {
        const { data, error } = await supabase.storage
            .from('curriculos')
            .createSignedUrl(currentCandidatura.arquivo_curriculo, 60);
        
        if (error) throw error;
        
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
        const loadingTask = pdfjsLib.getDocument(data.signedUrl);
        pdfDoc = await loadingTask.promise;
        
        totalPages = pdfDoc.numPages;
        currentPageNum = 1;
        
        elements.totalPages.textContent = totalPages;
        elements.currentPage.textContent = currentPageNum;
        
        await renderPdfPage(currentPageNum);
        
        elements.pdfViewer.classList.remove('hidden');
        elements.docViewer.classList.add('hidden');
        elements.curriculoModal.classList.remove('hidden');
        elements.detailsModal.classList.add('hidden');
        
    } catch (error) {
        console.error('Erro ao carregar PDF:', error);
        alert('Erro ao carregar o currículo. Tente baixar o arquivo.');
    }
}

async function renderPdfPage(pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = elements.pdfCanvas;
    const context = canvas.getContext('2d');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
    elements.currentPage.textContent = pageNum;
}

function viewDoc() {
    elements.pdfViewer.classList.add('hidden');
    elements.docViewer.classList.remove('hidden');
    elements.curriculoModal.classList.remove('hidden');
    elements.detailsModal.classList.add('hidden');
}

function showPrevPage() {
    if (currentPageNum > 1) {
        currentPageNum--;
        renderPdfPage(currentPageNum);
    }
}

function showNextPage() {
    if (currentPageNum < totalPages) {
        currentPageNum++;
        renderPdfPage(currentPageNum);
    }
}

async function downloadCurriculo() {
    if (!currentCandidatura) return;
    
    try {
        const { data, error } = await supabase.storage
            .from('curriculos')
            .download(currentCandidatura.arquivo_curriculo);
        
        if (error) throw error;
        
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentCandidatura.arquivo_curriculo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Erro ao baixar currículo:', error);
        alert('Erro ao baixar o currículo.');
    }
}

// Exclusão de Candidatura
function showConfirmDelete() {
    elements.confirmModal.classList.remove('hidden');
    elements.detailsModal.classList.add('hidden');
}

function closeConfirmModal() {
    elements.confirmModal.classList.add('hidden');
}

async function deleteCandidatura() {
    if (!currentCandidatura) return;
    
    try {
        // Excluir arquivo do storage
        const { error: storageError } = await supabase.storage
            .from('curriculos')
            .remove([currentCandidatura.arquivo_curriculo]);
        
        if (storageError) throw storageError;
        
        // Excluir registro do banco
        const { error: dbError } = await supabase
            .from('candidaturas')
            .delete()
            .eq('id', currentCandidatura.id);
        
        if (dbError) throw dbError;
        
        alert('Candidatura excluída com sucesso!');
        elements.confirmModal.classList.add('hidden');
        await loadCandidaturas();
        await loadDashboardData(); // Atualizar dashboard
        
    } catch (error) {
        console.error('Erro ao excluir candidatura:', error);
        alert('Erro ao excluir a candidatura.');
    }
}

// Utilitários
function showLoading(show) {
    elements.loadingIndicator.style.display = show ? 'block' : 'none';
}

// Tornar funções globais para uso em onclick
window.editVaga = editVaga;
window.deleteVaga = deleteVaga;
