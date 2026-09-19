from app.rag.ingest import chunk_document, load_chunks
from app.rag.store import VectorStore


def test_corpus_loads_with_metadata():
    chunks = load_chunks()
    assert len(chunks) >= 6
    assert all(c.title and c.source for c in chunks)
    assert len({c.id for c in chunks}) == len(chunks)


def test_chunking_splits_long_documents():
    body = "\n\n".join(["paragraph " * 60 for _ in range(6)])
    chunks = chunk_document("doc", "Title", "src", ["tag"], body)
    assert len(chunks) > 1
    assert all(c.id.startswith("doc#") for c in chunks)


def test_lexical_search_finds_the_right_document():
    store = VectorStore()
    chunks = load_chunks()
    store.set_chunks(chunks)

    hits = store.search_lexical("how much sodium is in broth for blood pressure", 3)
    assert hits
    assert "sodium" in chunks[hits[0][0]].title.lower()

    hits = store.search_lexical("facial drooping slurred speech emergency", 3)
    assert "red flag" in chunks[hits[0][0]].title.lower()


def test_lexical_scores_are_normalised():
    store = VectorStore()
    store.set_chunks(load_chunks())
    hits = store.search_lexical("glycaemic index", 3)
    assert abs(hits[0][1] - 1.0) < 1e-6


def test_dense_search_ranks_by_cosine():
    store = VectorStore()
    store.set_chunks(load_chunks())
    store.set_vectors([[float(i == j) for j in range(4)] for i in range(len(store.chunks))])
    hits = store.search_dense([1.0, 0.0, 0.0, 0.0], 2)
    assert len(hits) == 2
    assert hits[0][1] >= hits[1][1]


def test_empty_store_returns_nothing_rather_than_raising():
    store = VectorStore()
    assert store.search_lexical("anything", 3) == []
    assert store.search_dense([1.0], 3) == []
