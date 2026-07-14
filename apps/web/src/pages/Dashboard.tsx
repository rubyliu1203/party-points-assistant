import { Card, Row, Col, Statistic } from 'antd';
import { TeamOutlined, TrophyOutlined, CalendarOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { memberApi } from '../api/members';
import { quarterApi } from '../api/quarters';

function DashboardPage() {
  const [stats, setStats] = useState({
    memberCount: 0,
    quarterCount: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [memberRes, quarterRes]: any = await Promise.all([
        memberApi.getMembers(),
        quarterApi.getQuarters(),
      ]);

      if (memberRes.code === 200) {
        setStats(prev => ({ ...prev, memberCount: memberRes.data.length }));
      }
      if (quarterRes.code === 200) {
        setStats(prev => ({ ...prev, quarterCount: quarterRes.data.length }));
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>仪表盘</h2>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="党员人数"
              value={stats.memberCount}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="季度数量"
              value={stats.quarterCount}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="当前积分周期"
              value="2026 Q2"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="快速入口">
            <p>欢迎使用党员党务积分助手！</p>
            <p>本系统支持：</p>
            <ul>
              <li>党员人员管理（职务、党务工作者身份）</li>
              <li>党员积分台账（基础分、履职分、加分、扣分）</li>
              <li>党务积分管理（月度/季度汇总）</li>
              <li>报表导出（含公示版）</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default DashboardPage;
