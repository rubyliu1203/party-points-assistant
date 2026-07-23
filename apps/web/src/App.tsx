import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/Layout';
import MemberManagePage from './pages/MemberManage';
import ScorePage from './pages/ScorePage';
import DashboardPage from './pages/Dashboard';
import WorkScorePage from './pages/WorkScorePage';
import BonusPage from './pages/BonusPage';
import DeductionPage from './pages/DeductionPage';
import RoleScorePage from './pages/RoleScorePage';
import ShareWorkScorePage from './pages/ShareWorkScorePage';

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#cf1322',
          borderRadius: 4,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="members" element={<MemberManagePage />} />
            <Route path="scores" element={<ScorePage />} />
            <Route path="work-scores" element={<WorkScorePage />} />
            <Route path="bonus" element={<BonusPage />} />
            <Route path="deductions" element={<DeductionPage />} />
            <Route path="role-scores" element={<RoleScorePage />} />
          </Route>
          {/* 公开分享页面（无需登录，无侧边栏） */}
          <Route path="/share/work-score" element={<ShareWorkScorePage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
