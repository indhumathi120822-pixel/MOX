const express = require('express');
const router = express.Router();
const { run, get } = require('../db');

// GitHub Webhook Endpoint (Push / PR events trigger automated local scan)
router.post('/github', async (req, res) => {
  try {
    const event = req.headers['x-github-event'] || 'push';
    const payload = req.body;

    const repoName = payload.repository ? payload.repository.full_name : 'Unknown Repo';
    const commitSha = payload.after || (payload.pull_request ? payload.pull_request.head.sha : 'head');

    console.log(`[GITHUB WEBHOOK] Received ${event} for ${repoName} (${commitSha})`);

    // Audit log
    await run(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`, [
      1,
      'GITHUB_WEBHOOK_EVENT',
      `GitHub webhook triggered event '${event}' for repo ${repoName} (SHA: ${commitSha})`
    ]);

    res.json({
      message: 'GitHub webhook received successfully.',
      event,
      repository: repoName,
      commit: commitSha,
      status: 'Triggered Headless Scan'
    });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing error.' });
  }
});

module.exports = router;
