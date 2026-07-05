// apps/backend/src/utils/louvain.ts
import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { getLLMProvider } from '../services/llm/llmProvider.js';

interface Edge {
  source: string;
  target: string;
  weight: number;
}

export async function computeGraphClusters(userId: string): Promise<void> {
  logger.info(`Computing Louvain-style topic clusters for user ${userId}...`);

  try {
    // 1. Fetch all documents for user
    const documents = await prisma.document.findMany({
      where: { userId, status: 'INDEXED' },
      select: { id: true, title: true, documentTags: { include: { tag: true } } },
    });

    if (documents.length === 0) return;

    const docIds = documents.map(d => d.id);
    const adj = new Map<string, Array<{ target: string; weight: number }>>();

    // Helper to add edges
    const addEdge = (u: string, v: string, w: number) => {
      if (!adj.has(u)) adj.set(u, []);
      adj.get(u)!.push({ target: v, weight: w });
      if (!adj.has(v)) adj.set(v, []);
      adj.get(v)!.push({ target: u, weight: w });
    };

    // 2. Fetch document relations from DB
    const relations = await prisma.documentRelation.findMany({
      where: { sourceDocument: { userId } },
      select: { sourceDocId: true, targetDocId: true, strength: true },
    });

    for (const rel of relations) {
      addEdge(rel.sourceDocId, rel.targetDocId, rel.strength || 0.5);
    }

    // 3. Add edges for shared tags
    const documentTags = await prisma.documentTag.findMany({
      where: { document: { userId } },
      select: { documentId: true, tagId: true },
    });

    const tagToDocs = new Map<string, string[]>();
    for (const dt of documentTags) {
      const docs = tagToDocs.get(dt.tagId) ?? [];
      docs.push(dt.documentId);
      tagToDocs.set(dt.tagId, docs);
    }

    for (const [, docs] of tagToDocs.entries()) {
      if (docs.length < 2) continue;
      for (let i = 0; i < docs.length; i++) {
        for (let j = i + 1; j < docs.length; j++) {
          addEdge(docs[i]!, docs[j]!, 0.3); // shared tag strength
        }
      }
    }

    // 4. Greedy Label Propagation community detection
    const communities = new Map<string, string>();
    for (const id of docIds) {
      communities.set(id, id);
    }

    let changed = true;
    let iterations = 0;
    const maxIterations = 15;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const node of docIds) {
        const currentComm = communities.get(node)!;
        let bestComm = currentComm;
        let maxWeight = 0.0;

        const neighbors = adj.get(node) || [];
        const commWeights = new Map<string, number>();

        for (const edge of neighbors) {
          const nComm = communities.get(edge.target)!;
          commWeights.set(nComm, (commWeights.get(nComm) || 0.0) + edge.weight);
        }

        for (const [comm, weight] of commWeights.entries()) {
          if (weight > maxWeight) {
            maxWeight = weight;
            bestComm = comm;
          }
        }

        if (bestComm !== currentComm && maxWeight > 0.1) {
          communities.set(node, bestComm);
          changed = true;
        }
      }
    }

    // 5. Group documents by community
    const communityGroups = new Map<string, string[]>();
    for (const [docId, commId] of communities.entries()) {
      const list = communityGroups.get(commId) ?? [];
      list.push(docId);
      communityGroups.set(commId, list);
    }

    // Clear old clusters
    await prisma.cluster.deleteMany({ where: { userId } });

    // 6. Label each cluster using LLM and insert into database
    const provider = getLLMProvider();
    const docMap = new Map(documents.map(d => [d.id, d]));

    const colors = ['#E07F5F', '#7F77DD', '#1D9E75', '#E0A85F', '#5FC3E0', '#BA7517', '#E74C3C', '#2ECC71'];
    let colorIdx = 0;

    for (const [commId, members] of communityGroups.entries()) {
      const titles = members.map(id => docMap.get(id)?.title).filter(Boolean);
      if (titles.length === 0) continue;

      let label = 'Unlabeled Topic';
      try {
        const prompt = `Given the following list of document titles grouped in a similarity cluster, generate a single concise title/name (1 to 3 words max) that best summarizes their common subject.
Output ONLY the label. Do not include quotes, formatting, or commentary.

Titles:
${titles.join('\n')}

Topic Label:`;

        const rawLabel = await provider.generate(prompt, 'You generate extremely concise 1-3 word names for folders and categories.');
        label = rawLabel.trim().replace(/^["']|["']$/g, '');
      } catch (e) {
        logger.warn('Failed to generate cluster label with LLM: ', e);
        label = `Topic Cluster ${members.length}`;
      }

      const color = colors[colorIdx % colors.length];
      colorIdx++;

      await prisma.cluster.create({
        data: {
          userId,
          label,
          color,
          documentIds: members,
        },
      });
    }

    logger.info(`Successfully generated ${communityGroups.size} clusters for user ${userId}`);
  } catch (error) {
    logger.error('Failed to compute graph clusters:', error);
  }
}
