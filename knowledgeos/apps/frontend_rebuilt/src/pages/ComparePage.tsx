// apps/frontend_rebuilt/src/pages/ComparePage.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface DocumentListItem {
  id: string;
  title: string;
}

interface ComparisonResult {
  documents: { id: string; title: string }[];
  comparisons: {
    comparisonMatrix: { category: string; docValues: string[] }[];
    similarities: string[];
    differences: string[];
    contradictions: string[];
  };
}

export default function ComparePage() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await api.get<{ success: boolean; data: { documents: DocumentListItem[] } }>('/api/documents?limit=100');
      if (res.data.success) {
        setDocuments(res.data.data.documents);
      }
    } catch (e) {
      console.error('Failed to load documents list:', e);
    }
  };

  const handleCheckboxChange = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) return;
    setIsComparing(true);
    setResult(null);
    setError(null);

    try {
      const res = await api.post<{ success: boolean; data: ComparisonResult }>('/api/documents/compare', {
        documentIds: selectedIds
      });
      if (res.data.success) {
        setResult(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Comparison failed.');
      console.error(err);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-60px)] bg-[#0b1326] text-[#dae2fd]">
      {/* Sidebar - Select Documents */}
      <div className="w-[300px] border-r border-white/5 bg-[#090e1a] p-lg flex flex-col gap-md">
        <div>
          <h2 className="font-display font-bold text-xs uppercase tracking-widest text-primary mb-sm">Document Comparison</h2>
          <p className="text-xs text-slate-400 mb-md leading-relaxed">
            Select 2 or more documents from your library to perform a side-by-side conceptual comparison.
          </p>

          <button
            onClick={handleCompare}
            disabled={selectedIds.length < 2 || isComparing}
            className="w-full bg-primary text-on-primary py-sm rounded-lg text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all mb-md"
          >
            {isComparing ? (
              <>
                <div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
                Comparing...
              </>
            ) : 'Compare Selected'}
          </button>

          {error && <p className="text-[10px] text-red-400 font-medium leading-relaxed mb-sm">{error}</p>}
        </div>

        <hr className="border-white/5" />

        {/* List with Checkboxes */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-xs">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Select docs ({selectedIds.length} chosen)</span>
          {documents.map((doc) => (
            <label
              key={doc.id}
              className={`flex items-start gap-sm p-sm rounded-lg border cursor-pointer transition-all select-none ${
                selectedIds.includes(doc.id)
                  ? 'bg-primary/5 border-primary/30 text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(doc.id)}
                onChange={() => handleCheckboxChange(doc.id)}
                className="mt-[3px] accent-primary"
              />
              <span className="text-xs font-medium leading-relaxed truncate">{doc.title}</span>
            </label>
          ))}
          {documents.length === 0 && (
            <p className="text-slate-500 text-xs italic text-center py-8">No documents found</p>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 p-2xl overflow-y-auto">
        {result ? (
          <div className="max-w-[1000px] mx-auto space-y-xl">
            <div className="pb-md border-b border-white/5">
              <h1 className="text-xl font-bold font-display text-white">Side-by-Side Comparison</h1>
              <p className="text-xs text-slate-400 mt-xs">AI-synthesized comparisons across key conceptual parameters</p>
            </div>

            {/* Matrix Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="p-md font-bold text-slate-400 uppercase tracking-wider w-[180px]">Category</th>
                    {result.documents.map((doc) => (
                      <th key={doc.id} className="p-md font-bold text-primary truncate max-w-[240px]">
                        {doc.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.comparisons.comparisonMatrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.01]">
                      <td className="p-md font-semibold text-white bg-white/[0.01]">{row.category}</td>
                      {row.docValues.map((val, valIdx) => (
                        <td key={valIdx} className="p-md text-slate-300 leading-relaxed font-mono">
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              {/* Similarities */}
              <div className="bg-[#090e1a]/40 border border-white/5 rounded-2xl p-lg space-y-sm">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-xs">
                  <span className="material-symbols-outlined text-sm">handshake</span>
                  Key Similarities
                </h3>
                <ul className="space-y-xs text-xs text-slate-300 list-disc list-inside leading-relaxed">
                  {result.comparisons.similarities.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                  {result.comparisons.similarities.length === 0 && <li className="italic text-slate-500">None identified.</li>}
                </ul>
              </div>

              {/* Differences */}
              <div className="bg-[#090e1a]/40 border border-white/5 rounded-2xl p-lg space-y-sm">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-xs">
                  <span className="material-symbols-outlined text-sm">difference</span>
                  Key Differences
                </h3>
                <ul className="space-y-xs text-xs text-slate-300 list-disc list-inside leading-relaxed">
                  {result.comparisons.differences.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                  {result.comparisons.differences.length === 0 && <li className="italic text-slate-500">None identified.</li>}
                </ul>
              </div>

              {/* Contradictions */}
              <div className="bg-[#090e1a]/40 border border-white/5 rounded-2xl p-lg space-y-sm">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-xs">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Contradictions
                </h3>
                <ul className="space-y-xs text-xs text-slate-300 list-disc list-inside leading-relaxed">
                  {result.comparisons.contradictions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                  {result.comparisons.contradictions.length === 0 && <li className="italic text-slate-500">None identified.</li>}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-[400px] mx-auto gap-md py-20">
            <span className="material-symbols-outlined text-4xl text-primary/50">compare</span>
            <div>
              <h2 className="text-sm font-semibold text-white">Compare Documents</h2>
              <p className="text-xs text-slate-400 mt-xs leading-relaxed">
                Select 2 or more files from the sidebar list and click "Compare Selected" to start analysis.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
