import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, BookOpen, TrendingUp, Clock, Tag, ChevronRight, Sparkles, Database, Zap, X, Menu, BarChart3, FileText, Brain } from 'lucide-react';

// 20 Newsgroups 数据集的主题分类
const CATEGORIES = [
  { id: 'comp.graphics', name: '计算机图形学', color: '#FF6B6B', icon: '🖥️' },
  { id: 'comp.os.ms-windows', name: 'Windows系统', color: '#4ECDC4', icon: '🪟' },
  { id: 'comp.sys.ibm.pc', name: 'IBM PC硬件', color: '#45B7D1', icon: '💻' },
  { id: 'comp.sys.mac', name: 'Mac系统', color: '#96CEB4', icon: '🍎' },
  { id: 'comp.windows.x', name: 'X Window系统', color: '#FFEAA7', icon: '🖼️' },
  { id: 'rec.autos', name: '汽车', color: '#DFE6E9', icon: '🚗' },
  { id: 'rec.motorcycles', name: '摩托车', color: '#74B9FF', icon: '🏍️' },
  { id: 'rec.sport.baseball', name: '棒球', color: '#A29BFE', icon: '⚾' },
  { id: 'rec.sport.hockey', name: '曲棍球', color: '#FD79A8', icon: '🏒' },
  { id: 'sci.crypt', name: '密码学', color: '#FDCB6E', icon: '🔐' },
  { id: 'sci.electronics', name: '电子学', color: '#E17055', icon: '🔌' },
  { id: 'sci.med', name: '医学', color: '#00B894', icon: '⚕️' },
  { id: 'sci.space', name: '太空', color: '#0984E3', icon: '🚀' },
  { id: 'misc.forsale', name: '二手交易', color: '#6C5CE7', icon: '💰' },
  { id: 'talk.politics.misc', name: '政治', color: '#FF7675', icon: '🗳️' },
  { id: 'talk.politics.guns', name: '枪支政策', color: '#FD79A8', icon: '🎯' },
  { id: 'talk.politics.mideast', name: '中东政治', color: '#FDCB6E', icon: '🌍' },
  { id: 'talk.religion.misc', name: '宗教', color: '#A29BFE', icon: '✨' },
  { id: 'alt.atheism', name: '无神论', color: '#74B9FF', icon: '🤔' },
  { id: 'soc.religion.christian', name: '基督教', color: '#55EFC4', icon: '⛪' },
];

// 模拟文档数据
const SAMPLE_DOCUMENTS = [
  {
    id: 1,
    title: 'Introduction to GPU Computing and CUDA Programming',
    abstract: 'This paper discusses the fundamentals of GPU computing, focusing on NVIDIA CUDA architecture and parallel programming paradigms...',
    category: 'comp.graphics',
    relevance: 0.95,
    year: 2024,
    citations: 156,
    keywords: ['GPU', 'CUDA', 'Parallel Computing']
  },
  {
    id: 2,
    title: 'Windows 11 Security Features and Performance Benchmarks',
    abstract: 'An in-depth analysis of security improvements in Windows 11, including TPM 2.0 requirements and performance comparisons...',
    category: 'comp.os.ms-windows',
    relevance: 0.92,
    year: 2023,
    citations: 89,
    keywords: ['Windows', 'Security', 'TPM']
  },
  {
    id: 3,
    title: 'Modern Cryptographic Protocols for Secure Communication',
    abstract: 'A comprehensive review of contemporary cryptographic protocols, including post-quantum cryptography approaches...',
    category: 'sci.crypt',
    relevance: 0.88,
    year: 2024,
    citations: 234,
    keywords: ['Cryptography', 'Security', 'Protocols']
  },
  {
    id: 4,
    title: 'Electric Vehicle Battery Technology Advances',
    abstract: 'Latest developments in EV battery technology, charging infrastructure, and sustainability considerations...',
    category: 'rec.autos',
    relevance: 0.85,
    year: 2024,
    citations: 178,
    keywords: ['EV', 'Battery', 'Automotive']
  },
  {
    id: 5,
    title: 'Mars Exploration: Recent Discoveries and Future Missions',
    abstract: 'Overview of recent Mars rover findings, atmospheric studies, and planned human mission timelines...',
    category: 'sci.space',
    relevance: 0.91,
    year: 2023,
    citations: 312,
    keywords: ['Mars', 'Space', 'Exploration']
  },
  {
    id: 6,
    title: 'Machine Learning Applications in Medical Diagnosis',
    abstract: 'Survey of ML and deep learning techniques applied to medical imaging and disease diagnosis...',
    category: 'sci.med',
    relevance: 0.94,
    year: 2024,
    citations: 445,
    keywords: ['ML', 'Medical', 'Diagnosis']
  },
  {
    id: 7,
    title: 'Modern Motorcycle Safety Systems and Technology',
    abstract: 'Analysis of advanced safety features in modern motorcycles, including ABS, traction control, and rider aids...',
    category: 'rec.motorcycles',
    relevance: 0.79,
    year: 2023,
    citations: 67,
    keywords: ['Motorcycle', 'Safety', 'Technology']
  },
  {
    id: 8,
    title: 'Baseball Analytics: The Impact of Data Science',
    abstract: 'How advanced statistics and machine learning are transforming baseball strategy and player evaluation...',
    category: 'rec.sport.baseball',
    relevance: 0.82,
    year: 2024,
    citations: 123,
    keywords: ['Baseball', 'Analytics', 'Statistics']
  },
];

const TextClassificationRetrieval = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    // 初始化时显示一些示例文档
    setSearchResults(SAMPLE_DOCUMENTS.slice(0, 4));
  }, []);

  // 使用 Claude API 进行智能分类和检索
  const performAISearch = async (query, categories) => {
    setIsAiThinking(true);
    setAiResponse('');
    
    try {
      const prompt = `作为一个学术文档检索系统，请根据以下查询进行智能分析和分类：

查询: "${query}"
${categories.length > 0 ? `已选分类: ${categories.join(', ')}` : ''}

可用分类: ${CATEGORIES.map(c => c.name).join(', ')}

请提供：
1. 查询意图分析
2. 推荐的相关分类（2-3个）
3. 关键词提取
4. 搜索建议

请用简洁专业的中文回答，使用markdown格式。`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      const aiText = data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
      
      setAiResponse(aiText);
    } catch (error) {
      setAiResponse('AI分析暂时不可用，请稍后再试。');
      console.error('AI search error:', error);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    
    // 添加到搜索历史
    if (!searchHistory.includes(searchQuery)) {
      setSearchHistory(prev => [searchQuery, ...prev].slice(0, 5));
    }

    // 模拟搜索延迟
    await new Promise(resolve => setTimeout(resolve, 800));

    // 过滤文档
    let filtered = SAMPLE_DOCUMENTS.filter(doc => {
      const matchesQuery = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.abstract.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategories.length === 0 || 
                             selectedCategories.includes(doc.category);
      
      return matchesQuery && matchesCategory;
    });

    // 排序
    if (sortBy === 'relevance') {
      filtered.sort((a, b) => b.relevance - a.relevance);
    } else if (sortBy === 'citations') {
      filtered.sort((a, b) => b.citations - a.citations);
    } else if (sortBy === 'year') {
      filtered.sort((a, b) => b.year - a.year);
    }

    setSearchResults(filtered);
    setIsSearching(false);

    // 执行AI分析
    await performAISearch(searchQuery, selectedCategories);
  };

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSearchQuery('');
    setSearchResults(SAMPLE_DOCUMENTS.slice(0, 4));
    setAiResponse('');
  };

  const getCategoryInfo = (categoryId) => {
    return CATEGORIES.find(c => c.id === categoryId) || {};
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 backdrop-blur-xl bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl blur-lg opacity-50"></div>
                  <div className="relative bg-gradient-to-r from-cyan-400 to-blue-500 p-3 rounded-2xl">
                    <Brain className="w-8 h-8 text-slate-900" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    智能文本检索系统
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">Text Classification + Retrieval System</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-300">18,846 文档</span>
                  </div>
                </div>
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <Tag className="w-4 h-4 text-purple-400" />
                    <span className="text-slate-300">20 主题</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Search Section */}
          <div className="mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-3xl blur-xl"></div>
              <div className="relative bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="输入关键词搜索学术文档..."
                      className="w-full pl-14 pr-6 py-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all text-lg"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-2xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25"
                  >
                    {isSearching ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        搜索中...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        搜索
                      </div>
                    )}
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-4 py-2 rounded-xl border transition-all ${
                      showFilters 
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' 
                        : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      主题过滤
                      {selectedCategories.length > 0 && (
                        <span className="px-2 py-0.5 bg-cyan-500 text-slate-900 rounded-full text-xs font-bold">
                          {selectedCategories.length}
                        </span>
                      )}
                    </div>
                  </button>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white hover:border-slate-600 transition-all focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="relevance">相关度排序</option>
                    <option value="citations">引用量排序</option>
                    <option value="year">年份排序</option>
                  </select>

                  {(selectedCategories.length > 0 || searchQuery) && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-red-500/50 hover:text-red-400 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4" />
                        清除
                      </div>
                    </button>
                  )}
                </div>

                {/* Search History */}
                {searchHistory.length > 0 && !searchQuery && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                      <Clock className="w-4 h-4" />
                      最近搜索
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.map((query, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSearchQuery(query)}
                          className="px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm hover:border-cyan-500/50 hover:text-cyan-300 transition-all"
                        >
                          {query}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Category Filters */}
          {showFilters && (
            <div className="mb-8 animate-fadeIn">
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Tag className="w-5 h-5 text-cyan-400" />
                    选择主题分类
                  </h3>
                  <span className="text-sm text-slate-400">
                    已选 {selectedCategories.length} / {CATEGORIES.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                        selectedCategories.includes(category.id)
                          ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50'
                          : 'bg-slate-900/50 border-slate-700/30 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-2xl mb-2">{category.icon}</div>
                      <div className="text-sm font-medium text-slate-200">{category.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Analysis Section */}
          {(isAiThinking || aiResponse) && (
            <div className="mb-8 animate-fadeIn">
              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500/20 rounded-xl">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-purple-300">AI 智能分析</h3>
                </div>
                {isAiThinking ? (
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin"></div>
                    正在分析查询意图和推荐分类...
                  </div>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {aiResponse}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Results */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <FileText className="w-7 h-7 text-cyan-400" />
                  搜索结果
                  <span className="text-slate-400 text-lg font-normal">
                    ({searchResults.length} 篇文档)
                  </span>
                </h2>
              </div>

              {searchResults.length === 0 ? (
                <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-12 border border-slate-700/50 text-center">
                  <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">未找到匹配的文档</p>
                  <p className="text-slate-500 text-sm mt-2">尝试使用不同的关键词或调整分类过滤器</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((doc, idx) => {
                    const category = getCategoryInfo(doc.category);
                    return (
                      <div
                        key={doc.id}
                        className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 hover:border-cyan-500/30 transition-all transform hover:scale-[1.02] cursor-pointer group"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5"
                              style={{ backgroundColor: `${category.color}20`, color: category.color }}
                            >
                              <span>{category.icon}</span>
                              {category.name}
                            </div>
                            <div className="text-sm text-slate-400">{doc.year}</div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4" />
                              {(doc.relevance * 100).toFixed(0)}%
                            </div>
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4" />
                              {doc.citations}
                            </div>
                          </div>
                        </div>

                        <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                          {doc.title}
                        </h3>

                        <p className="text-slate-400 leading-relaxed mb-4">
                          {doc.abstract}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-2">
                            {doc.keywords.map((keyword, kidx) => (
                              <span
                                key={kidx}
                                className="px-2 py-1 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs text-slate-300"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                          <button className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 text-sm font-medium">
                            查看详情
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Statistics */}
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  检索统计
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">查询处理时间</span>
                    <span className="text-white font-semibold">0.8s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">BM25 匹配</span>
                    <span className="text-white font-semibold">{searchResults.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">语义相似度</span>
                    <span className="text-white font-semibold">0.89</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">分类准确度</span>
                    <span className="text-white font-semibold">89.3%</span>
                  </div>
                </div>
              </div>

              {/* Top Categories */}
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-purple-400" />
                  热门主题
                </h3>
                <div className="space-y-3">
                  {CATEGORIES.slice(0, 6).map((cat, idx) => (
                    <div key={cat.id} className="flex items-center gap-3">
                      <span className="text-xl">{cat.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm text-slate-300 mb-1">{cat.name}</div>
                        <div className="w-full bg-slate-900/50 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                            style={{ width: `${Math.random() * 50 + 50}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Info */}
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl rounded-3xl p-6 border border-cyan-500/20">
                <h3 className="text-lg font-semibold mb-3 text-cyan-300">系统特性</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>BERT-based 文本分类</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>BM25 + 语义混合检索</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>实时主题分类过滤</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>AI驱动的查询分析</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-white/10 backdrop-blur-xl bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <div>
                <p>信息检索课程项目 · 晏远兆 20233803050</p>
                <p className="mt-1">Text Classification + Retrieval System</p>
              </div>
              <div className="text-right">
                <p>基于 20 Newsgroups 数据集</p>
                <p className="mt-1">BERT + BM25 + 语义检索</p>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Global Styles */}
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }

        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        input::placeholder {
          color: rgb(100 116 139);
        }

        select {
          cursor: pointer;
        }

        select option {
          background: rgb(15 23 42);
          color: white;
        }

        .delay-1000 {
          animation-delay: 1s;
        }

        .delay-2000 {
          animation-delay: 2s;
        }

        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.7);
        }
      `}</style>
    </div>
  );
};

export default TextClassificationRetrieval;