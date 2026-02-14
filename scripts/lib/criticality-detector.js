/**
 * Criticality Detection Engine
 *
 * Detects recurring learnings across phases/milestones using vector clustering.
 * Identifies patterns that appear frequently (high criticality) vs one-off observations.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Compute cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Similarity score [0, 1]
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Detect critical learnings from vector store using similarity clustering
 *
 * @param {string} projectId - SHA256 hash of project directory
 * @param {Object} options - Detection options
 * @param {number} options.similarityThreshold - Minimum cosine similarity for clustering (default: 0.75)
 * @param {number} options.minClusterSize - Minimum items in cluster for criticality (default: 3)
 * @param {number} options.maxLearnings - Maximum critical learnings to return (default: 15)
 * @returns {Promise<Array>} - Array of critical learnings with metadata
 */
async function detectCriticalLearnings(projectId, options = {}) {
  const {
    similarityThreshold = 0.75,
    minClusterSize = 3,
    maxLearnings = 15
  } = options;

  // Graceful degradation: check if gsd-memory is built
  const transformerPath = path.join(__dirname, '../../gsd-memory/dist/embeddings/transformer.js');
  if (!fs.existsSync(transformerPath)) {
    console.warn('⚠ gsd-memory not built (run: cd gsd-memory && npm run build)');
    return [];
  }

  // Check if vectra is installed
  const vectraPath = path.join(__dirname, '../../gsd-memory/node_modules/vectra');
  if (!fs.existsSync(vectraPath)) {
    console.warn('⚠ vectra not installed in gsd-memory (run: cd gsd-memory && npm install)');
    return [];
  }

  try {
    // Import dependencies
    const { LocalIndex } = require(path.join(vectraPath, 'lib/index.js'));

    // Check if vector index exists
    const indexPath = path.join(os.homedir(), '.gsd', 'knowledge', projectId);
    if (!fs.existsSync(indexPath)) {
      // Cold start - index not created yet
      return [];
    }

    // Open index
    const index = new LocalIndex(indexPath);
    if (!(await index.isIndexCreated())) {
      return [];
    }

    // Load all items from vector index
    const allItems = await index.listItems();
    if (!allItems || allItems.length === 0) {
      return [];
    }

    // Extract vectors and metadata
    const items = [];
    for (const item of allItems) {
      const itemData = await index.getItem(item);
      if (itemData && itemData.vector && itemData.metadata) {
        items.push({
          id: item,
          vector: itemData.vector,
          metadata: itemData.metadata
        });
      }
    }

    if (items.length === 0) {
      return [];
    }

    // Cluster items by cosine similarity
    const visited = new Set();
    const clusters = [];

    for (let i = 0; i < items.length; i++) {
      if (visited.has(i)) continue;

      const cluster = [i];
      visited.add(i);

      // Find all similar items
      for (let j = i + 1; j < items.length; j++) {
        if (visited.has(j)) continue;

        const similarity = cosineSimilarity(items[i].vector, items[j].vector);
        if (similarity >= similarityThreshold) {
          cluster.push(j);
          visited.add(j);
        }
      }

      clusters.push(cluster);
    }

    // Filter clusters by size and cross-phase presence
    const criticalClusters = clusters.filter(cluster => {
      if (cluster.length < minClusterSize) return false;

      // Check if cluster has items from 2+ different phases
      const phases = new Set();
      for (const idx of cluster) {
        const phase = items[idx].metadata.phase;
        if (phase) phases.add(phase);
      }

      return phases.size >= 2;
    });

    // For each qualifying cluster, select representative item
    const criticalLearnings = [];

    for (const cluster of criticalClusters) {
      // Calculate average similarity to cluster for each item
      let bestIdx = cluster[0];
      let bestAvgSim = -1;

      for (const candidateIdx of cluster) {
        let totalSim = 0;
        for (const otherIdx of cluster) {
          if (candidateIdx !== otherIdx) {
            totalSim += cosineSimilarity(
              items[candidateIdx].vector,
              items[otherIdx].vector
            );
          }
        }
        const avgSim = cluster.length > 1 ? totalSim / (cluster.length - 1) : 0;

        if (avgSim > bestAvgSim) {
          bestAvgSim = avgSim;
          bestIdx = candidateIdx;
        }
      }

      // Extract metadata from cluster
      const representative = items[bestIdx];
      const milestones = new Set();
      const phases = new Set();

      for (const idx of cluster) {
        const meta = items[idx].metadata;
        if (meta.milestone) milestones.add(meta.milestone);
        if (meta.phase) phases.add(meta.phase);
      }

      criticalLearnings.push({
        type: representative.metadata.type || 'unknown',
        learning: representative.metadata.text || '',
        frequency: cluster.length,
        milestones: Array.from(milestones).sort(),
        phases: Array.from(phases).sort(),
        representative: representative.metadata
      });
    }

    // Sort by frequency descending
    criticalLearnings.sort((a, b) => b.frequency - a.frequency);

    // Cap at maxLearnings
    return criticalLearnings.slice(0, maxLearnings);

  } catch (error) {
    console.warn(`⚠ Error detecting critical learnings: ${error.message}`);
    return [];
  }
}

module.exports = {
  detectCriticalLearnings,
  cosineSimilarity
};
