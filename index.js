const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP a cada 15 minutos
  message: {
    error: 'Muitas requisições deste IP, tente novamente em 15 minutos.'
  }
});

// Middlewares
app.use(helmet());
app.use(limiter);
app.use(cors({
  origin: [
    'https://seu-usuario.github.io', // Substitua pelo seu domínio no GitHub Pages
    'http://localhost:3000', // Para desenvolvimento local
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use a service key para ter mais permissões
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do Multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limite
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF e Word são permitidos'), false);
    }
  }
});

// Health Check Endpoint (importante para o Render)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Servidor está funcionando corretamente',
    timestamp: new Date().toISOString()
  });
});

// Endpoint principal para receber currículos
app.post('/api/curriculos', upload.single('curriculo'), async (req, res) => {
  try {
    console.log('Recebendo solicitação de currículo...');
    
    // Validar campos obrigatórios
    const requiredFields = ['nome', 'telefone', 'cpf', 'cep', 'estado', 'cidade', 'bairro', 'rua', 'vaga'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Campos obrigatórios faltando: ${missingFields.join(', ')}`
      });
    }

    // Validar arquivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo do currículo é obrigatório'
      });
    }

    const { nome, telefone, cpf, cep, estado, cidade, bairro, rua, vaga } = req.body;
    
    // Limpar CPF (remover caracteres não numéricos)
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    // Verificar duplicidade (mesmo CPF para mesma vaga)
    console.log('Verificando duplicidade...');
    const { data: existing, error: checkError } = await supabase
      .from('curriculos')
      .select('id')
      .eq('cpf', cpfLimpo)
      .eq('vaga', vaga);

    if (checkError) {
      console.error('Erro ao verificar duplicidade:', checkError);
      throw new Error('Erro interno do servidor');
    }

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Você já enviou um currículo para esta vaga.'
      });
    }

    // Fazer upload do arquivo para o Supabase Storage
    console.log('Fazendo upload do arquivo...');
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `curriculo_${cpfLimpo}_${Date.now()}${fileExtension}`;
    
    const { data: fileData, error: uploadError } = await supabase.storage
      .from('curriculos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Erro no upload do arquivo:', uploadError);
      throw new Error('Falha no upload do arquivo');
    }

    // Salvar dados no Supabase
    console.log('Salvando dados no banco...');
    const { data: dbData, error: dbError } = await supabase
      .from('curriculos')
      .insert([
        {
          nome: nome.trim(),
          telefone: telefone.trim(),
          cpf: cpfLimpo,
          cep: cep.trim(),
          estado: estado.trim(),
          cidade: cidade.trim(),
          bairro: bairro.trim(),
          rua: rua.trim(),
          vaga: vaga,
          arquivo_curriculo: fileName,
          data_envio: new Date().toISOString(),
          ip_address: req.ip // Para controle de segurança
        }
      ])
      .select();

    if (dbError) {
      console.error('Erro ao salvar no banco:', dbError);
      
      // Se houve erro ao salvar no banco, deletar o arquivo do storage
      await supabase.storage
        .from('curriculos')
        .remove([fileName]);
      
      throw new Error('Falha ao salvar os dados do currículo');
    }

    console.log('Currículo salvo com sucesso!');
    
    // Resposta de sucesso
    res.status(201).json({
      success: true,
      message: 'Currículo enviado com sucesso!',
      data: {
        id: dbData[0].id,
        nome: dbData[0].nome,
        vaga: dbData[0].vaga,
        data_envio: dbData[0].data_envio
      }
    });

  } catch (error) {
    console.error('Erro no processamento:', error);
    
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Arquivo muito grande. O tamanho máximo é 5MB.'
        });
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Erro interno do servidor'
    });
  }
});

// Endpoint para listar vagas disponíveis (opcional)
app.get('/api/vagas', async (req, res) => {
  try {
    // Em um sistema real, isso viria de uma tabela no banco
    const vagas = [
      {
        id: 'desenvolvedor-frontend',
        titulo: 'Desenvolvedor Front-end',
        descricao: 'React, TypeScript, CSS avançado. Experiência com componentes reutilizáveis.',
        tipo: 'Remoto'
      },
      {
        id: 'desenvolvedor-backend',
        titulo: 'Desenvolvedor Back-end',
        descricao: 'Node.js, Python, bancos de dados. Conhecimento em arquitetura de microserviços.',
        tipo: 'Híbrido'
      },
      {
        id: 'analista-dados',
        titulo: 'Analista de Dados',
        descricao: 'Python, SQL, Power BI. Conhecimento em machine learning é um diferencial.',
        tipo: 'Presencial'
      },
      {
        id: 'designer-ux',
        titulo: 'Designer UX/UI',
        descricao: 'Figma, Adobe XD, pesquisa de usuário. Portfólio obrigatório.',
        tipo: 'Remoto'
      },
      {
        id: 'gerente-projetos',
        titulo: 'Gerente de Projetos',
        descricao: 'Metodologias ágeis, gestão de equipes, planejamento estratégico.',
        tipo: 'Híbrido'
      }
    ];

    res.json({
      success: true,
      data: vagas
    });

  } catch (error) {
    console.error('Erro ao buscar vagas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Endpoint para estatísticas (opcional)
app.get('/api/estatisticas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('curriculos')
      .select('vaga, data_envio');

    if (error) throw error;

    const totalCurriculos = data.length;
    const curriculosPorVaga = data.reduce((acc, curr) => {
      acc[curr.vaga] = (acc[curr.vaga] || 0) + 1;
      return acc;
    }, {});

    // Currículos dos últimos 7 dias
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    
    const curriculosRecentes = data.filter(item => 
      new Date(item.data_envio) > seteDiasAtras
    ).length;

    res.json({
      success: true,
      data: {
        total_curriculos: totalCurriculos,
        curriculos_7_dias: curriculosRecentes,
        por_vaga: curriculosPorVaga
      }
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
    message: 'Endpoint não encontrado'
  });
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor'
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Health check disponível em: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, encerrando servidor graciosamente...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, encerrando servidor graciosamente...');
  process.exit(0);
});
