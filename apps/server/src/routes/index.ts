import { Router } from 'express';
import { memberController } from '../controllers/memberController';
import { quarterController } from '../controllers/quarterController';
import { scoreController } from '../controllers/scoreController';
import { workScoreController } from '../controllers/workScoreController';
import { bonusController, deductionController } from '../controllers/bonusController';
import { reportController } from '../controllers/reportController';

const router = Router();

// 党员管理
router.get('/members', memberController.getMembers);
router.get('/members/:id', memberController.getMember);
router.post('/members', memberController.createMember);
router.put('/members/:id', memberController.updateMember);
router.delete('/members/:id', memberController.deleteMember);

// 季度管理
router.get('/quarters', quarterController.getQuarters);
router.post('/quarters', quarterController.createQuarter);
router.get('/quarters/current', quarterController.getCurrentQuarter);
router.put('/quarters/current', quarterController.setCurrentQuarter);

// 党员积分
router.get('/scores', scoreController.getScores);
router.get('/scores/:memberId/:quarterId', scoreController.getMemberScore);
router.put('/scores/:memberId/:quarterId/performance', scoreController.updatePerformance);
router.put('/scores/:memberId/:quarterId/basic', scoreController.updateBasicScore);
router.put('/scores/:memberId/:quarterId/veto', scoreController.updateVeto);
router.post('/scores/:quarterId/recalculate', scoreController.recalculateScores);

// 履职分明细
router.get('/role-scores/:memberId/:quarterId', scoreController.getRoleScores);
router.put('/role-scores/:detailId', scoreController.updateRoleScore);

// 加分记录
router.get('/bonus-records', bonusController.getBonusRecords);
router.post('/bonus-records', bonusController.createBonusRecord);
router.put('/bonus-records/:id', bonusController.updateBonusRecord);
router.delete('/bonus-records/:id', bonusController.deleteBonusRecord);

// 扣分记录
router.get('/deduction-records', deductionController.getDeductionRecords);
router.post('/deduction-records', deductionController.createDeductionRecord);
router.put('/deduction-records/:id', deductionController.updateDeductionRecord);
router.delete('/deduction-records/:id', deductionController.deleteDeductionRecord);

// 党务加分
router.get('/work-scores', workScoreController.getWorkScores);
router.get('/work-scores/summary', workScoreController.getWorkScoreSummary);
router.put('/work-scores/:id', workScoreController.updateWorkScore);
router.post('/work-scores/recalculate', workScoreController.recalculateBaseBonus);
router.get('/work-score-details', workScoreController.getWorkScoreDetails);
router.post('/work-score-details', workScoreController.createWorkScoreDetail);
router.delete('/work-score-details/:id', workScoreController.deleteWorkScoreDetail);

// 报表导出
router.get('/reports/score-summary', reportController.exportScoreSummary);
router.get('/reports/work-score-summary', reportController.exportWorkScoreSummary);
router.get('/reports/public-score', reportController.exportPublicScore);

export default router;
