// apps/frontend_rebuilt/src/pages/MentorPage.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface MentorSession {
  id: string;
  topic: string;
  difficulty: string;
  status: string;
  roadmap: any[];
  progress: any[];
}

export default function MentorPage() {
  const [sessions, setSessions] = useState<MentorSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<MentorSession | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Mentor Creation fields
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('BEGINNER');
  const [isInitializing, setIsInitializing] = useState(false);

  // Active Lesson fields
  const [activeTab, setActiveTab] = useState<'study' | 'quiz' | 'assignment'>('study');
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<any | null>(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);

  // Assignment fields
  const [assignmentPrompt, setAssignmentPrompt] = useState<string | null>(null);
  const [assignmentSubmission, setAssignmentSubmission] = useState('');
  const [assignmentResult, setAssignmentResult] = useState<any | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await api.get<{ success: boolean; data: MentorSession[] }>('/api/mentor/sessions');
      if (res.data.success) {
        setSessions(res.data.data);
        if (res.data.data.length > 0 && !selectedSession) {
          fetchSessionDetails(res.data.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessionDetails = async (id: string) => {
    try {
      const res = await api.get<{ success: boolean; data: MentorSession }>(`/api/mentor/session/${id}`);
      if (res.data.success) {
        setSelectedSession(res.data.data);
        const syllabus = res.data.data.roadmap || [];
        if (syllabus.length > 0) {
          handleSelectNode(syllabus[0].nodeId, res.data.data);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectNode = (nodeId: string, _sessionContext = selectedSession) => {
    setActiveNodeId(nodeId);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizResult(null);
    setAssignmentPrompt(null);
    setAssignmentSubmission('');
    setAssignmentResult(null);
    setActiveTab('study');
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsInitializing(true);
    try {
      const res = await api.post<{ success: boolean; data: MentorSession }>('/api/mentor/session', { topic, difficulty });
      if (res.data.success) {
        setTopic('');
        await fetchSessions();
        fetchSessionDetails(res.data.data.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInitializing(false);
    }
  };

  // Load Quiz
  const loadQuiz = async () => {
    if (!selectedSession || !activeNodeId) return;
    setIsLoadingQuiz(true);
    setQuizResult(null);
    try {
      const res = await api.post<{ success: boolean; data: { questions: any[] } }>(
        `/api/mentor/session/${selectedSession.id}/quiz`,
        { nodeId: activeNodeId }
      );
      if (res.data.success) {
        setQuizQuestions(res.data.data.questions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  // Submit Quiz Answers
  const submitQuiz = async () => {
    if (!selectedSession || !activeNodeId) return;
    try {
      const res = await api.post<{ success: boolean; data: any }>(
        `/api/mentor/session/${selectedSession.id}/quiz/submit`,
        { nodeId: activeNodeId, answers: quizAnswers, questions: quizQuestions }
      );
      if (res.data.success) {
        setQuizResult(res.data.data);
        // Refresh session details to update mastery score
        fetchSessionDetails(selectedSession.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load Assignment
  const loadAssignment = async () => {
    if (!selectedSession || !activeNodeId) return;
    setIsLoadingAssignment(true);
    setAssignmentResult(null);
    try {
      const res = await api.post<{ success: boolean; data: { prompt: string } }>(
        `/api/mentor/session/${selectedSession.id}/assignment`,
        { nodeId: activeNodeId }
      );
      if (res.data.success) {
        setAssignmentPrompt(res.data.data.prompt);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAssignment(false);
    }
  };

  // Submit Assignment Essay
  const submitAssignment = async () => {
    if (!selectedSession || !activeNodeId || !assignmentSubmission.trim() || !assignmentPrompt) return;
    setIsGrading(true);
    try {
      const res = await api.post<{ success: boolean; data: any }>(
        `/api/mentor/session/${selectedSession.id}/assignment/submit`,
        { nodeId: activeNodeId, submission: assignmentSubmission, prompt: assignmentPrompt }
      );
      if (res.data.success) {
        setAssignmentResult(res.data.data.grade);
        fetchSessionDetails(selectedSession.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGrading(false);
    }
  };

  // Find active node roadmap details
  const activeRoadmapNode = selectedSession?.roadmap?.find((n: any) => n.nodeId === activeNodeId);
  const activeProgressNode = selectedSession?.progress?.find((p: any) => p.nodeId === activeNodeId);

  return (
    <div className="flex h-full min-h-[calc(100vh-60px)] bg-[#0b1326] text-[#dae2fd]">
      {/* Session Navigation Column */}
      <div className="w-[300px] border-r border-white/5 bg-[#090e1a] p-lg flex flex-col gap-lg">
        <div>
          <h2 className="font-display font-bold text-xs uppercase tracking-widest text-primary mb-sm">AI Mentor</h2>
          <form onSubmit={handleStartSession} className="flex flex-col gap-xs">
            <input
              type="text"
              placeholder="e.g. Operating Systems"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-sm py-xs text-xs focus:outline-none focus:border-primary/50 text-on-surface"
              disabled={isInitializing}
            />
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded px-sm py-xs text-xs focus:outline-none text-slate-300 cursor-pointer"
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
            <button
              type="submit"
              className="bg-primary text-on-primary py-xs rounded text-xs font-bold hover:brightness-110 cursor-pointer"
              disabled={isInitializing}
            >
              {isInitializing ? 'Starting Course...' : 'Teach me topic'}
            </button>
          </form>
        </div>

        <hr className="border-white/5" />

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto space-y-md">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-xs">Active Courses</h3>
            <div className="space-y-xs">
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => fetchSessionDetails(s.id)}
                  className={`px-md py-sm rounded-lg cursor-pointer transition-all border ${
                    selectedSession?.id === s.id
                      ? 'bg-white/5 border-white/10 text-primary'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">{s.topic}</div>
                  <div className="text-[9px] font-medium text-slate-500 mt-xs uppercase">{s.difficulty}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Lesson Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {selectedSession ? (
          <>
            {/* Syllabus Sidebar */}
            <div className="w-[240px] border-r border-white/5 p-lg overflow-y-auto space-y-md">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Syllabus</h3>
              <div className="space-y-xs">
                {selectedSession.roadmap.map((node: any, idx: number) => {
                  const progress = selectedSession.progress.find((p: any) => p.nodeId === node.nodeId);
                  const score = progress?.masteryScore || 0;
                  return (
                    <div
                      key={node.nodeId}
                      onClick={() => handleSelectNode(node.nodeId)}
                      className={`p-sm rounded-lg cursor-pointer transition-all ${
                        activeNodeId === node.nodeId
                          ? 'bg-primary/10 border border-primary/20 text-primary'
                          : 'hover:bg-white/5 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{node.title}</div>
                      <div className="flex justify-between items-center mt-xs">
                        <span className="text-[9px] font-mono text-slate-500">Lesson {idx + 1}</span>
                        {score > 0 && (
                          <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full ${score >= 0.8 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {Math.round(score * 100)}% Mastery
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lesson Content Tab view */}
            <div className="flex-1 p-2xl overflow-y-auto flex flex-col gap-lg">
              {activeRoadmapNode ? (
                <>
                  <div className="pb-md border-b border-white/5">
                    <h1 className="text-xl font-bold text-white">{activeRoadmapNode.title}</h1>
                    <p className="text-xs text-slate-400 mt-xs">{activeRoadmapNode.description}</p>
                    <div className="flex gap-sm mt-md">
                      {['study', 'quiz', 'assignment'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveTab(t as any)}
                          className={`px-md py-sm rounded-lg border text-xs font-semibold cursor-pointer uppercase tracking-wider transition-all ${
                            activeTab === t
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1">
                    {/* STUDY TAB */}
                    {activeTab === 'study' && (
                      <div className="space-y-md">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-lg space-y-md">
                          <h3 className="text-sm font-semibold text-white">Study Lesson Notes</h3>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            This lesson covers the fundamentals of {activeRoadmapNode.title}. Review matching library documents or use Q&A to ask follow-up questions to your AI Mentor.
                          </p>
                          <div className="text-xs bg-black/20 border border-white/5 p-md rounded-lg text-slate-400 italic">
                            Tip: To learn faster, generate flashcards using the Revision deck or start an interactive chat with matching documents.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* QUIZ TAB */}
                    {activeTab === 'quiz' && (
                      <div className="space-y-md">
                        {quizQuestions.length === 0 ? (
                          <div className="text-center py-xl bg-white/5 border border-white/10 rounded-xl flex flex-col items-center gap-md">
                            <span className="material-symbols-outlined text-4xl text-slate-600">quiz</span>
                            <div>
                              <h4 className="text-xs font-semibold text-white">Ready for a Quiz?</h4>
                              <p className="text-[10px] text-slate-400 mt-1 max-w-[240px]">Test your mastery of this concept node with a short 3-question adaptive quiz.</p>
                            </div>
                            <button
                              onClick={loadQuiz}
                              className="bg-primary text-on-primary px-md py-xs rounded text-xs font-bold hover:brightness-110 cursor-pointer"
                              disabled={isLoadingQuiz}
                            >
                              {isLoadingQuiz ? 'Generating...' : 'Start Quiz'}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-lg">
                            {quizQuestions.map((q, idx) => (
                              <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-lg space-y-md">
                                <h4 className="text-xs font-semibold text-white">Question {idx + 1}: {q.question}</h4>
                                <div className="grid grid-cols-2 gap-sm">
                                  {q.options.map((opt: string) => {
                                    const isSelected = quizAnswers[q.id] === opt;
                                    return (
                                      <button
                                        key={opt}
                                        onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                                        className={`p-sm text-left rounded-lg border text-xs transition-all ${
                                          isSelected
                                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                        }`}
                                        disabled={!!quizResult}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                                {quizResult && (
                                  <div className="mt-md pt-sm border-t border-white/5">
                                    <span className={`text-[10px] font-bold ${quizResult.reviewDetails[idx].isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {quizResult.reviewDetails[idx].isCorrect ? 'Correct' : 'Incorrect (Correct: ' + q.correctAnswer + ')'}
                                    </span>
                                    <p className="text-[11px] text-slate-400 mt-1">{q.explanation}</p>
                                  </div>
                                )}
                              </div>
                            ))}

                            {!quizResult ? (
                              <button
                                onClick={submitQuiz}
                                className="bg-primary text-on-primary px-lg py-sm rounded-lg text-xs font-bold hover:brightness-110 cursor-pointer"
                              >
                                Submit Answers
                              </button>
                            ) : (
                              <button
                                onClick={loadQuiz}
                                className="border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 px-lg py-sm rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Try Again
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ASSIGNMENT TAB */}
                    {activeTab === 'assignment' && (
                      <div className="space-y-md">
                        {!assignmentPrompt ? (
                          <div className="text-center py-xl bg-white/5 border border-white/10 rounded-xl flex flex-col items-center gap-md">
                            <span className="material-symbols-outlined text-4xl text-slate-600">assignment</span>
                            <div>
                              <h4 className="text-xs font-semibold text-white">AI Grading Assignment</h4>
                              <p className="text-[10px] text-slate-400 mt-1 max-w-[240px]">Submit a short written paragraph explaining a key mechanism of this lesson.</p>
                            </div>
                            <button
                              onClick={loadAssignment}
                              className="bg-primary text-on-primary px-md py-xs rounded text-xs font-bold hover:brightness-110 cursor-pointer"
                              disabled={isLoadingAssignment}
                            >
                              {isLoadingAssignment ? 'Generating...' : 'Get Assignment Prompt'}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-md">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-lg space-y-md">
                              <h4 className="text-xs font-semibold text-white">Assignment Prompt:</h4>
                              <p className="text-xs text-slate-300 font-medium leading-relaxed">{assignmentPrompt}</p>
                            </div>

                            {!assignmentResult ? (
                              <div className="space-y-sm">
                                <textarea
                                  placeholder="Write your explanation here..."
                                  rows={6}
                                  value={assignmentSubmission}
                                  onChange={(e) => setAssignmentSubmission(e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl p-lg text-xs text-on-surface focus:outline-none focus:border-primary/50"
                                />
                                <button
                                  onClick={submitAssignment}
                                  className="bg-primary text-on-primary px-lg py-sm rounded-lg text-xs font-bold hover:brightness-110 cursor-pointer flex items-center gap-2"
                                  disabled={isGrading || !assignmentSubmission.trim()}
                                >
                                  {isGrading ? (
                                    <>
                                      <div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
                                      Grading Response...
                                    </>
                                  ) : 'Submit Submission'}
                                </button>
                              </div>
                            ) : (
                              <div className="bg-white/5 border border-white/10 rounded-xl p-lg space-y-md">
                                <h4 className="text-xs font-semibold text-white">Grading Result & Feedback</h4>
                                <div className="flex items-center gap-sm">
                                  <span className={`text-lg font-bold px-3 py-1 rounded-lg ${assignmentResult.score >= 0.8 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                    Score: {Math.round(assignmentResult.score * 100)}%
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{assignmentResult.feedback}</p>
                                {assignmentResult.weakAreas?.length > 0 && (
                                  <div>
                                    <h5 className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Flagged Weak Areas:</h5>
                                    <div className="flex gap-xs mt-xs">
                                      {assignmentResult.weakAreas.map((w: string) => (
                                        <span key={w} className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">{w}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <button
                                  onClick={() => setAssignmentResult(null)}
                                  className="border border-white/10 text-slate-300 hover:text-white px-md py-xs rounded text-xs font-semibold cursor-pointer"
                                >
                                  Submit New Answer
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 italic py-20 text-xs">
                  Select a lesson in the syllabus sidebar to begin study
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-[400px] mx-auto gap-md py-20">
            <span className="material-symbols-outlined text-4xl text-primary/50">school</span>
            <div>
              <h2 className="text-sm font-semibold text-white">Start an AI Mentor Session</h2>
              <p className="text-xs text-slate-400 mt-xs leading-relaxed">
                Choose a topic (e.g. Database Indexing) and select a difficulty. Your AI Mentor will build an adaptive curriculum and test your recall through interactive quizzes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
