"""
Text Classification + Retrieval System
Information Retrieval Course Project - Topic 2

This module implements a topic-filtered retrieval system combining
text classification and search functionality.
"""

import os
import json
import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from sklearn.datasets import fetch_20newsgroups
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, accuracy_score
import torch
from transformers import BertTokenizer, BertForSequenceClassification, Trainer, TrainingArguments
from sentence_transformers import SentenceTransformer
import faiss
from elasticsearch import Elasticsearch

# ============================================================================
# Data Models
# ============================================================================

@dataclass
class Document:
    """Represents a document in the corpus."""
    id: str
    title: str
    content: str
    category: str
    embedding: Optional[np.ndarray] = None

@dataclass
class SearchResult:
    """Represents a search result."""
    document: Document
    score: float
    rank: int

@dataclass
class QueryClassification:
    """Represents query classification result."""
    category: str
    confidence: float

# ============================================================================
# 1. Data Layer - Document Processing and Storage
# ============================================================================

class DataLayer:
    """Handles document storage, indexing, and preprocessing."""
    
    def __init__(self, es_host: str = "localhost:9200"):
        self.es = Elasticsearch([es_host])
        self.documents: Dict[str, Document] = {}
        self.category_map: Dict[str, int] = {}
        
    def load_20newsgroups(self, subset: str = 'all') -> List[Document]:
        """Load the 20 Newsgroups dataset."""
        data = fetch_20newsgroups(
            subset=subset,
            remove=('headers', 'footers', 'quotes'),
            shuffle=True,
            random_state=42
        )
        
        documents = []
        self.category_map = {name: idx for idx, name in enumerate(data.target_names)}
        
        for idx, (text, label) in enumerate(zip(data.data, data.target)):
            doc = Document(
                id=f"doc_{idx}",
                title=text[:100].replace('\n', ' ').strip() + "...",
                content=text,
                category=data.target_names[label]
            )
            documents.append(doc)
            self.documents[doc.id] = doc
            
        return documents
    
    def preprocess_text(self, text: str) -> str:
        """Basic text preprocessing."""
        import re
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def index_to_elasticsearch(self, documents: List[Document], index_name: str = "documents"):
        """Index documents to Elasticsearch for BM25 search."""
        # Create index with appropriate mappings
        mapping = {
            "mappings": {
                "properties": {
                    "title": {"type": "text", "analyzer": "english"},
                    "content": {"type": "text", "analyzer": "english"},
                    "category": {"type": "keyword"}
                }
            }
        }
        
        if self.es.indices.exists(index=index_name):
            self.es.indices.delete(index=index_name)
        self.es.indices.create(index=index_name, body=mapping)
        
        # Index documents
        for doc in documents:
            self.es.index(
                index=index_name,
                id=doc.id,
                body={
                    "title": doc.title,
                    "content": doc.content,
                    "category": doc.category
                }
            )
        
        self.es.indices.refresh(index=index_name)
        print(f"Indexed {len(documents)} documents to Elasticsearch")

# ============================================================================
# 2. Classification Module - BERT-based Document/Query Classifier
# ============================================================================

class ClassificationModule:
    """BERT-based text classification for documents and queries."""
    
    def __init__(self, model_name: str = "bert-base-uncased", num_labels: int = 20):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = BertTokenizer.from_pretrained(model_name)
        self.model = BertForSequenceClassification.from_pretrained(
            model_name,
            num_labels=num_labels
        ).to(self.device)
        self.label_map: Dict[int, str] = {}
        
    def prepare_dataset(self, texts: List[str], labels: List[int]):
        """Prepare dataset for training."""
        encodings = self.tokenizer(
            texts,
            truncation=True,
            padding=True,
            max_length=512,
            return_tensors="pt"
        )
        
        class TextDataset(torch.utils.data.Dataset):
            def __init__(self, encodings, labels):
                self.encodings = encodings
                self.labels = labels
                
            def __getitem__(self, idx):
                item = {key: val[idx] for key, val in self.encodings.items()}
                item['labels'] = torch.tensor(self.labels[idx])
                return item
            
            def __len__(self):
                return len(self.labels)
        
        return TextDataset(encodings, labels)
    
    def train(self, train_texts: List[str], train_labels: List[int], 
              val_texts: List[str], val_labels: List[int],
              output_dir: str = "./classifier_model"):
        """Fine-tune BERT for classification."""
        train_dataset = self.prepare_dataset(train_texts, train_labels)
        val_dataset = self.prepare_dataset(val_texts, val_labels)
        
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=3,
            per_device_train_batch_size=16,
            per_device_eval_batch_size=16,
            warmup_steps=500,
            weight_decay=0.01,
            logging_dir='./logs',
            logging_steps=100,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
        )
        
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
        )
        
        trainer.train()
        self.model.save_pretrained(output_dir)
        self.tokenizer.save_pretrained(output_dir)
        
    def predict(self, text: str) -> QueryClassification:
        """Classify a single text (document or query)."""
        self.model.eval()
        
        inputs = self.tokenizer(
            text,
            truncation=True,
            padding=True,
            max_length=512,
            return_tensors="pt"
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
            predicted_class = torch.argmax(probs, dim=1).item()
            confidence = probs[0][predicted_class].item()
            
        return QueryClassification(
            category=self.label_map.get(predicted_class, str(predicted_class)),
            confidence=confidence
        )
    
    def batch_predict(self, texts: List[str]) -> List[QueryClassification]:
        """Classify multiple texts."""
        return [self.predict(text) for text in texts]

# ============================================================================
# 3. Retrieval Module - Hybrid Search (BM25 + Semantic)
# ============================================================================

class RetrievalModule:
    """Hybrid retrieval combining BM25 and semantic search."""
    
    def __init__(self, es_host: str = "localhost:9200"):
        self.es = Elasticsearch([es_host])
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.faiss_index = None
        self.doc_id_map: List[str] = []
        
    def build_vector_index(self, documents: List[Document]):
        """Build FAISS index for semantic search."""
        print("Computing document embeddings...")
        texts = [doc.content[:1000] for doc in documents]  # Truncate for efficiency
        embeddings = self.embedding_model.encode(texts, show_progress_bar=True)
        
        # Store embeddings in documents
        for doc, emb in zip(documents, embeddings):
            doc.embedding = emb
            
        # Build FAISS index
        dimension = embeddings.shape[1]
        self.faiss_index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        
        # Normalize embeddings for cosine similarity
        faiss.normalize_L2(embeddings)
        self.faiss_index.add(embeddings)
        
        self.doc_id_map = [doc.id for doc in documents]
        print(f"Built FAISS index with {len(documents)} documents")
        
    def bm25_search(self, query: str, category_filter: Optional[str] = None, 
                    top_k: int = 100, index_name: str = "documents") -> List[Tuple[str, float]]:
        """Perform BM25 search using Elasticsearch."""
        must_clauses = [
            {"multi_match": {
                "query": query,
                "fields": ["title^2", "content"],
                "type": "best_fields"
            }}
        ]
        
        filter_clauses = []
        if category_filter:
            filter_clauses.append({"term": {"category": category_filter}})
            
        body = {
            "query": {
                "bool": {
                    "must": must_clauses,
                    "filter": filter_clauses
                }
            },
            "size": top_k
        }
        
        response = self.es.search(index=index_name, body=body)
        
        results = []
        for hit in response['hits']['hits']:
            results.append((hit['_id'], hit['_score']))
            
        return results
    
    def semantic_search(self, query: str, top_k: int = 100) -> List[Tuple[str, float]]:
        """Perform semantic search using FAISS."""
        query_embedding = self.embedding_model.encode([query])
        faiss.normalize_L2(query_embedding)
        
        scores, indices = self.faiss_index.search(query_embedding, top_k)
        
        results = []
        for idx, score in zip(indices[0], scores[0]):
            if idx != -1:
                results.append((self.doc_id_map[idx], float(score)))
                
        return results
    
    def hybrid_search(self, query: str, category_filter: Optional[str] = None,
                      top_k: int = 20, alpha: float = 0.5) -> List[Tuple[str, float]]:
        """Combine BM25 and semantic search using Reciprocal Rank Fusion."""
        bm25_results = self.bm25_search(query, category_filter, top_k=100)
        semantic_results = self.semantic_search(query, top_k=100)
        
        # Reciprocal Rank Fusion
        k = 60  # RRF constant
        rrf_scores: Dict[str, float] = {}
        
        for rank, (doc_id, _) in enumerate(bm25_results):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + alpha / (k + rank + 1)
            
        for rank, (doc_id, _) in enumerate(semantic_results):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + (1 - alpha) / (k + rank + 1)
            
        # Sort by RRF score
        sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Apply category filter if semantic results included
        if category_filter:
            sorted_results = [(doc_id, score) for doc_id, score in sorted_results 
                            if self._get_doc_category(doc_id) == category_filter]
        
        return sorted_results[:top_k]
    
    def _get_doc_category(self, doc_id: str) -> Optional[str]:
        """Get document category from Elasticsearch."""
        try:
            response = self.es.get(index="documents", id=doc_id)
            return response['_source'].get('category')
        except:
            return None

# ============================================================================
# 4. Main System - Integration Layer
# ============================================================================

class TopicFilteredRetrievalSystem:
    """Main system integrating classification and retrieval."""
    
    def __init__(self):
        self.data_layer = DataLayer()
        self.classifier = ClassificationModule()
        self.retrieval = RetrievalModule()
        self.documents: Dict[str, Document] = {}
        
    def initialize(self, train: bool = False):
        """Initialize the system with data and models."""
        print("Loading dataset...")
        documents = self.data_layer.load_20newsgroups()
        self.documents = {doc.id: doc for doc in documents}
        
        print("Indexing documents to Elasticsearch...")
        self.data_layer.index_to_elasticsearch(documents)
        
        print("Building vector index...")
        self.retrieval.build_vector_index(documents)
        
        if train:
            print("Training classifier...")
            self._train_classifier(documents)
        else:
            print("Loading pre-trained classifier...")
            # Load pre-trained model if available
            
        print("System initialized!")
        
    def _train_classifier(self, documents: List[Document]):
        """Train the classification model."""
        # Split data
        train_size = int(0.8 * len(documents))
        train_docs = documents[:train_size]
        val_docs = documents[train_size:]
        
        train_texts = [doc.content for doc in train_docs]
        train_labels = [self.data_layer.category_map[doc.category] for doc in train_docs]
        
        val_texts = [doc.content for doc in val_docs]
        val_labels = [self.data_layer.category_map[doc.category] for doc in val_docs]
        
        # Set label map
        self.classifier.label_map = {v: k for k, v in self.data_layer.category_map.items()}
        
        self.classifier.train(train_texts, train_labels, val_texts, val_labels)
        
    def search(self, query: str, category_filter: Optional[str] = None,
               use_query_classification: bool = True, top_k: int = 10) -> Dict:
        """
        Main search interface.
        
        Args:
            query: User search query
            category_filter: Optional explicit category filter
            use_query_classification: Whether to classify query for filtering
            top_k: Number of results to return
            
        Returns:
            Dict containing results, query classification, and metadata
        """
        # Classify query if no explicit filter
        query_class = None
        if use_query_classification and not category_filter:
            query_class = self.classifier.predict(query)
            if query_class.confidence > 0.7:  # Only filter if confident
                category_filter = query_class.category
                
        # Perform hybrid search
        search_results = self.retrieval.hybrid_search(
            query, 
            category_filter=category_filter,
            top_k=top_k
        )
        
        # Build response
        results = []
        for rank, (doc_id, score) in enumerate(search_results, 1):
            if doc_id in self.documents:
                doc = self.documents[doc_id]
                results.append(SearchResult(
                    document=doc,
                    score=score,
                    rank=rank
                ))
                
        return {
            "query": query,
            "query_classification": query_class,
            "category_filter": category_filter,
            "results": results,
            "total_results": len(results)
        }

# ============================================================================
# 5. Evaluation Module
# ============================================================================

class Evaluator:
    """Evaluate system performance."""
    
    @staticmethod
    def precision_at_k(relevant: List[str], retrieved: List[str], k: int) -> float:
        """Calculate Precision@K."""
        retrieved_k = retrieved[:k]
        relevant_set = set(relevant)
        return len([doc for doc in retrieved_k if doc in relevant_set]) / k
    
    @staticmethod
    def recall_at_k(relevant: List[str], retrieved: List[str], k: int) -> float:
        """Calculate Recall@K."""
        retrieved_k = retrieved[:k]
        relevant_set = set(relevant)
        if not relevant_set:
            return 0.0
        return len([doc for doc in retrieved_k if doc in relevant_set]) / len(relevant_set)
    
    @staticmethod
    def ndcg_at_k(relevant: List[str], retrieved: List[str], k: int) -> float:
        """Calculate NDCG@K."""
        import math
        
        def dcg(scores: List[float]) -> float:
            return sum(rel / math.log2(i + 2) for i, rel in enumerate(scores))
        
        relevant_set = set(relevant)
        retrieved_k = retrieved[:k]
        
        # Binary relevance
        gains = [1.0 if doc in relevant_set else 0.0 for doc in retrieved_k]
        
        actual_dcg = dcg(gains)
        ideal_gains = sorted(gains, reverse=True)
        ideal_dcg = dcg(ideal_gains)
        
        return actual_dcg / ideal_dcg if ideal_dcg > 0 else 0.0
    
    @staticmethod
    def mrr(relevant: List[str], retrieved: List[str]) -> float:
        """Calculate Mean Reciprocal Rank."""
        relevant_set = set(relevant)
        for i, doc in enumerate(retrieved):
            if doc in relevant_set:
                return 1.0 / (i + 1)
        return 0.0

# ============================================================================
# 6. API Server (FastAPI)
# ============================================================================

"""
To run the API server, create a separate file (api.py):

from fastapi import FastAPI, Query
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="TopicSearch API")
system = TopicFilteredRetrievalSystem()

@app.on_event("startup")
async def startup():
    system.initialize()

@app.get("/search")
async def search(
    q: str = Query(..., description="Search query"),
    category: Optional[str] = Query(None, description="Category filter"),
    top_k: int = Query(10, description="Number of results")
):
    results = system.search(q, category_filter=category, top_k=top_k)
    return results

@app.get("/categories")
async def get_categories():
    return list(system.data_layer.category_map.keys())

# Run with: uvicorn api:app --reload
"""

# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    # Example usage
    print("=" * 60)
    print("Text Classification + Retrieval System")
    print("Information Retrieval Course Project - Topic 2")
    print("=" * 60)
    
    # Initialize system
    system = TopicFilteredRetrievalSystem()
    
    # Note: In practice, you would call system.initialize() here
    # This requires Elasticsearch and model training
    
    print("\nSystem components:")
    print("1. DataLayer - Document storage and Elasticsearch indexing")
    print("2. ClassificationModule - BERT-based text classification")
    print("3. RetrievalModule - Hybrid BM25 + Semantic search")
    print("4. TopicFilteredRetrievalSystem - Integration layer")
    print("5. Evaluator - Performance metrics")
    
    print("\nTo run the full system:")
    print("1. Start Elasticsearch: docker run -p 9200:9200 elasticsearch:8.x")
    print("2. Initialize: system.initialize(train=True)")
    print("3. Search: results = system.search('GPU rendering performance')")
    print("4. Run API: uvicorn api:app --reload")
