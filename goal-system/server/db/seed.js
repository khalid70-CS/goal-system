const { randomUUID } = require('crypto');
const { insertRow } = require('./database');

function seedIfEmpty(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM goals').get().n > 0) return;
  const now = new Date().toISOString();
  const goalId = randomUUID();
  const sessionId = randomUUID();

  db.transaction(() => {
    insertRow(db, 'goals', {
      id: goalId, name: 'الحصول على شهادة AWS',
      description: 'إعداد واجتياز اختبار شهادة AWS Solutions Architect Associate',
      status: 'active', priority: 'high', tags: ['تعليم', 'تقنية'], createdAt: now, updatedAt: now,
    });
    insertRow(db, 'plans', {
      id: randomUUID(), goalId, name: 'خطة الـ 12 أسبوع',
      description: 'خطة مرحلية لمراجعة جميع خدمات AWS', order: 1, status: 'active', createdAt: now,
    });
    insertRow(db, 'sessions', {
      id: sessionId, goalId, title: 'جلسة مراجعة IAM', date: now, duration: 45,
      stopPoint: 'انتهيت من سياسات IAM الأساسية', nextStep: 'مراجعة IAM Roles و Trust Policies',
      summary: 'جلسة ممتازة، فهمت الفرق بين Users و Roles', isCompleted: true, createdAt: now,
    });
    insertRow(db, 'tasks', {
      id: randomUUID(), sessionId, title: 'مشاهدة فيديو IAM الأساسيات', status: 'completed', order: 1, createdAt: now,
    });
    insertRow(db, 'resources', {
      id: randomUUID(), goalId, name: 'دورة Stephane Maarek على Udemy', url: 'https://www.udemy.com',
      type: 'course', description: 'أفضل دورة لشهادة AWS SAA', createdAt: now,
    });
    insertRow(db, 'notes', {
      id: randomUUID(), goalId, sessionId, createdAt: now,
      content: 'تذكر: IAM Policy تتكون من Statement واحد أو أكثر، كل Statement يحتوي على Effect, Action, Resource',
    });
  })();
}

module.exports = { seedIfEmpty };
