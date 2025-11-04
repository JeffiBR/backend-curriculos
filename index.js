const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Validação de variáveis de ambiente
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error(`❌ Variáveis de ambiente faltando: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

// Configurações de Rate Limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisições deste IP, tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

const curriculoLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5, // Máximo 5 envios por hora por IP
    message: { error: 'Muitos envios de currículo. Tente novamente em uma hora.' }
});

// Configuração de CORS dinâmica
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            'https://seu-usuario.github.io',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️  Tentativa de acesso de origem não autorizada: ${origin}`);
            callback(new Error('Não permitido por CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

// Middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(generalLimiter);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuração do Supabase com tratamento de erro
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Credenciais do Supabase não encontradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

// Validação de dados de entrada
const validateInput = (data, file) => {
    const errors = [];

    // Validação de campos obrigatórios
    const requiredFields = ['nome', 'telefone', 'cpf', 'cep', 'estado', 'cidade', 'bairro', 'rua', 'vaga'];
    requiredFields.forEach(field => {
        if (!data[field] || data[field].trim().length === 0) {
            errors.push(`Campo ${field} é obrigatório`);
        }
    });

    // Validação de CPF
    const cpfLimpo = data.cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
        errors.push('CPF deve conter 11 dígitos');
    }

    // Validação de telefone
    const telefoneLimpo = data.telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
        errors.push('Telefone deve conter 10 ou 11 dígitos');
    }

    // Validação de CEP
    const cepLimpo = data.cep.replace(/\D/g, '');
    if (ceplimpo.length !== 8) {
        errors.push('CEP deve conter 8 dígitos');
    }

    // Validação de arquivo
    if (!file) {
        errors.push('Arquivo do currículo é obrigatório');
    }

    return errors;
};

// Configuração melhorada do Multer
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        const allowedExtensions = ['.pdf', '.doc', '.docx'];
        const fileExtension = path.extname(file.originalname).toLowerCase();

        if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de arquivo não permitido. Apenas ${allowedExtensions.join(', ')} são aceitos`));
        }
    }
});

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// Health Check melhorado
app.get('/health', async (req, res) => {
    const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'unknown'
    };

    try {
        // Testar conexão com o banco
        const { error } = await supabase
            .from('curriculos')
            .select('count')
            .limit(1);

        healthCheck.database = error ? 'error' : 'connected';
    } catch (error) {
        healthCheck.database = 'error';
        healthCheck.dbError = error.message;
    }

    const statusCode = healthCheck.database === 'connected' ? 200 : 503;
    
    res.status(statusCode).json(healthCheck);
});

// Endpoint principal para receber currículos
app.post('/api/curriculos', curriculoLimiter, upload.single('curriculo'), async (req, res) => {
    let uploadedFileName = null;
    
    try {
        console.log('📥 Recebendo novo currículo...');

        // Validação de entrada
        const validationErrors = validateInput(req.body, req.file);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Dados de entrada inválidos',
                errors: validationErrors
            });
        }

        const { nome, telefone, cpf, cep, estado, cidade, bairro, rua, vaga, numero } = req.body;
        
        // Limpar dados
        const cpfLimpo = cpf.replace(/\D/g, '');
        const telefoneLimpo = telefone.replace(/\D/g, '');
        const cepLimpo = cep.replace(/\D/g, '');

        // Verificar duplicidade
        console.log('🔍 Verificando duplicidade...');
        const { data: existing, error: checkError } = await supabase
            .from('curriculos')
            .select('id, data_envio')
            .eq('cpf', cpfLimpo)
            .eq('vaga', vaga)
            .maybeSingle();

        if (checkError) {
            console.error('❌ Erro ao verificar duplicidade:', checkError);
            throw new Error('Erro interno do servidor');
        }

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Você já enviou um currículo para esta vaga.',
                data_envio: existing.data_envio
            });
        }

        // Upload do arquivo
        console.log('📤 Fazendo upload do arquivo...');
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `curriculo_${cpfLimpo}_${Date.now()}${fileExtension}`;
        uploadedFileName = fileName;
        
        const { error: uploadError } = await supabase.storage
            .from('curriculos')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600'
            });

        if (uploadError) {
            console.error('❌ Erro no upload do arquivo:', uploadError);
            throw new Error('Falha no upload do arquivo');
        }

        // Salvar dados no banco
        console.log('💾 Salvando dados no banco...');
        const curriculoData = {
            nome: nome.trim(),
            telefone: telefoneLimpo,
            cpf: cpfLimpo,
            cep: cepLimpo,
            estado: estado.trim(),
            cidade: cidade.trim(),
            bairro: bairro.trim(),
            rua: rua.trim(),
            numero: numero ? numero.trim() : null,
            vaga: vaga.trim(),
            arquivo_curriculo: fileName,
            data_envio: new Date().toISOString(),
            ip_address: req.ip
        };

        const { data: dbData, error: dbError } = await supabase
            .from('curriculos')
            .insert([curriculoData])
            .select()
            .single();

        if (dbError) {
            console.error('❌ Erro ao salvar no banco:', dbError);
            throw new Error('Falha ao salvar os dados do currículo');
        }

        console.log('✅ Currículo salvo com sucesso! ID:', dbData.id);
        
        // Resposta de sucesso
        res.status(201).json({
            success: true,
            message: 'Currículo enviado com sucesso!',
            data: {
                id: dbData.id,
                nome: dbData.nome,
                vaga: dbData.vaga,
                data_envio: dbData.data_envio
            }
        });

    } catch (error) {
        console.error('❌ Erro no processamento:', error);
        
        // Limpeza em caso de erro
        if (uploadedFileName) {
            try {
                await supabase.storage
                    .from('curriculos')
                    .remove([uploadedFileName]);
                console.log('🧹 Arquivo temporário removido:', uploadedFileName);
            } catch (cleanupError) {
                console.error('❌ Erro na limpeza do arquivo:', cleanupError);
            }
        }

        // Tratamento específico de erros do Multer
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: 'Arquivo muito grande. O tamanho máximo é 5MB.'
                });
            }
            if (error.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({
                    success: false,
                    message: 'Apenas um arquivo é permitido por envio.'
                });
            }
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Erro interno do servidor'
        });
    }
});

// Endpoints existentes (mantidos da versão anterior)
app.get('/api/vagas', async (req, res) => {
    try {
        const vagas = [
            {
                id: 'desenvolvedor-frontend',
                titulo: 'Desenvolvedor Front-end',
                descricao: 'React, TypeScript, CSS avançado. Experiência com componentes reutilizáveis.',
                tipo: 'Remoto',
                salario: 'R$ 6.000 - R$ 10.000',
                requisitos: ['React', 'TypeScript', 'CSS', 'Git']
            },
            {
                id: 'desenvolvedor-backend',
                titulo: 'Desenvolvedor Back-end',
                descricao: 'Node.js, Python, bancos de dados. Conhecimento em arquitetura de microserviços.',
                tipo: 'Híbrido',
                salario: 'R$ 7.000 - R$ 12.000',
                requisitos: ['Node.js', 'Python', 'SQL', 'Docker']
            }
            // ... manter outros objetos de vaga
        ];

        res.json({
            success: true,
            data: vagas,
            total: vagas.length
        });

    } catch (error) {
        console.error('Erro ao buscar vagas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Endpoint de estatísticas com cache
let estatisticasCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

app.get('/api/estatisticas', async (req, res) => {
    try {
        // Verificar cache
        if (estatisticasCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
            return res.json({
                success: true,
                data: estatisticasCache,
                cached: true
            });
        }

        const { data, error } = await supabase
            .from('curriculos')
            .select('vaga, data_envio')
            .order('data_envio', { ascending: false });

        if (error) throw error;

        const totalCurriculos = data ? data.length : 0;
        
        const curriculosPorVaga = data ? data.reduce((acc, curr) => {
            acc[curr.vaga] = (acc[curr.vaga] || 0) + 1;
            return acc;
        }, {}) : {};

        // Currículos dos últimos 7 dias
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
        
        const curriculosRecentes = data ? data.filter(item => 
            new Date(item.data_envio) > seteDiasAtras
        ).length : 0;

        // Atualizar cache
        estatisticasCache = {
            total_curriculos: totalCurriculos,
            curriculos_7_dias: curriculosRecentes,
            por_vaga: curriculosPorVaga,
            ultima_atualizacao: new Date().toISOString()
        };
        cacheTimestamp = Date.now();

        res.json({
            success: true,
            data: estatisticasCache,
            cached: false
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint não encontrado',
        path: req.originalUrl
    });
});

// Middleware de tratamento de erros global
app.use((error, req, res, next) => {
    console.error('💥 Erro não tratado:', {
        message: error.message,
        stack: error.stack,
        url: req.originalUrl,
        ip: req.ip
    });

    // Erros de CORS
    if (error.message === 'Não permitido por CORS') {
        return res.status(403).json({
            success: false,
            message: 'Acesso não permitido'
        });
    }

    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
    });
});

// Inicialização do servidor
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Servidor rodando na porta ${PORT}
📍 Health check: http://localhost:${PORT}/health
📍 API Base URL: http://localhost:${PORT}/api
⏰ Iniciado em: ${new Date().toISOString()}
    `);
});

// Graceful shutdown melhorado
const shutdown = (signal) => {
    console.log(`\n🛑 Recebido ${signal}, encerrando servidor graciosamente...`);
    
    server.close((err) => {
        if (err) {
            console.error('❌ Erro ao fechar servidor:', err);
            process.exit(1);
        }
        
        console.log('✅ Servidor fechado com sucesso');
        process.exit(0);
    });

    // Timeout de 10 segundos para shutdown forçado
    setTimeout(() => {
        console.log('⏰ Timeout de shutdown, terminando forçadamente');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Rejeição não tratada em:', promise, 'motivo:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Exceção não capturada:', error);
    process.exit(1);
});
