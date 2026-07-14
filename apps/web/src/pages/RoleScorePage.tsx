import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Table, Button, InputNumber, Tag, Space, message, Switch, Tooltip } from 'antd';
import { ReloadOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { scoreApi } from '../api/scores';
import { memberApi } from '../api/members';
import { QUARTER_MONTHS } from '../utils/constants';

interface OutletContext {
  currentQuarter: { id: number; year: number; quarter: number } | null;
}

interface MemberWithDetails {
  id: number;
  name: string;
  isManager: boolean;
  displayOrder: number;
  details: RoleDetail[];
}

interface RoleDetail {
  id: number;
  partyMemberId: number;
  year: number;
  month: number;
  dim1HardBattle: number;
  dim2TechShare: number;
  dim3ShuangYou: number;
  dim4Culture: number;
  dim5ChinaStory: number;
  isHardBattleLeader: boolean;
  isShuangYou: boolean;
  isTeamLeader: boolean;
  cultureBaseScore: number | null;
  monthlyTotal: number | null;
}

// 季度规则常量
const DIM1_QUARTER_SCORES: Record<number, { leader: number; other: number }> = {
  1: { leader: 4, other: 3.0 },
  2: { leader: 4, other: 3.0 },
  3: { leader: 4, other: 3.5 },
  4: { leader: 4, other: 3.8 }
};

const DIM3_QUARTER_SCORES: Record<number, { shuangYou: number; teamLeader: number; other: number }> = {
  1: { shuangYou: 4, teamLeader: 4, other: 3.8 },
  2: { shuangYou: 4, teamLeader: 4, other: 3.8 },
  3: { shuangYou: 4, teamLeader: 4, other: 3.5 },
  4: { shuangYou: 4, teamLeader: 4, other: 3.8 }
};

function RoleScorePage() {
  const { currentQuarter } = useOutletContext<OutletContext>();
  const [memberDetails, setMemberDetails] = useState<MemberWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingMember, setEditingMember] = useState<number | null>(null);

  useEffect(() => {
    if (currentQuarter?.id) {
      loadData();
    }
  }, [currentQuarter]);

  const loadData = async () => {
    if (!currentQuarter?.id) return;
    setLoading(true);
    try {
      const [memberRes]: any = await Promise.all([
        memberApi.getMembers()
      ]);

      if (memberRes.code === 200) {
        const members = memberRes.data.filter((m: any) => m.status === 'active');
        
        // 为每个党员加载履职分明细
        const memberWithDetails = await Promise.all(
          members.map(async (member: any) => {
            try {
              const detailRes: any = await scoreApi.getRoleScores(member.id, currentQuarter.id);
              return {
                ...member,
                details: detailRes.code === 200 ? detailRes.data : []
              };
            } catch (e) {
              return { ...member, details: [] };
            }
          })
        );

        setMemberDetails(memberWithDetails);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateDim1 = (member: MemberWithDetails, detail: RoleDetail): number => {
    if (!currentQuarter) return 0;
    // 管理层或攻坚队责任党员 = 4分
    if (member.isManager || detail.isHardBattleLeader) return 4;
    // 其他按季度规则
    return DIM1_QUARTER_SCORES[currentQuarter.quarter]?.other || 3.0;
  };

  const calculateDim3 = (member: MemberWithDetails, detail: RoleDetail): number => {
    if (!currentQuarter) return 0;
    // 管理层 = 4分
    if (member.isManager) return 4;
    // 双优党员或团队长(三季度起) = 4分
    if (detail.isShuangYou || (currentQuarter.quarter >= 3 && detail.isTeamLeader)) return 4;
    // 其他按季度规则
    return DIM3_QUARTER_SCORES[currentQuarter.quarter]?.other || 3.8;
  };

  const handleToggleHardBattle = async (member: MemberWithDetails, detail: RoleDetail) => {
    try {
      const newValue = !detail.isHardBattleLeader;
      const res: any = await scoreApi.updateRoleScore(detail.id, {
        isHardBattleLeader: newValue,
        dim1HardBattle: newValue ? 4 : calculateDim1(member, { ...detail, isHardBattleLeader: false })
      });

      if (res.code === 200) {
        message.success(newValue ? '已标记为攻坚队责任党员' : '已取消攻坚队责任党员标记');
        loadData();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleToggleShuangYou = async (member: MemberWithDetails, detail: RoleDetail) => {
    try {
      const newValue = !detail.isShuangYou;
      const res: any = await scoreApi.updateRoleScore(detail.id, {
        isShuangYou: newValue,
        dim3ShuangYou: newValue ? 4 : calculateDim3(member, { ...detail, isShuangYou: false })
      });

      if (res.code === 200) {
        message.success(newValue ? '已标记为双优党员' : '已取消双优党员标记');
        loadData();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleToggleTeamLeader = async (member: MemberWithDetails, detail: RoleDetail) => {
    if (currentQuarter && currentQuarter.quarter < 3) {
      message.info('三季度起团队长才享有加分');
    }
    
    try {
      const newValue = !detail.isTeamLeader;
      const res: any = await scoreApi.updateRoleScore(detail.id, {
        isTeamLeader: newValue,
        dim3ShuangYou: newValue ? 4 : calculateDim3(member, { ...detail, isTeamLeader: false })
      });

      if (res.code === 200) {
        message.success(newValue ? '已标记为团队长' : '已取消团队长标记');
        loadData();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleScoreChange = async (detail: RoleDetail, field: string, value: number) => {
    try {
      const res: any = await scoreApi.updateRoleScore(detail.id, {
        [field]: value
      });

      if (res.code === 200) {
        loadData();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 获取当前季度的月份
  const getMonths = () => {
    if (!currentQuarter) return [];
    return QUARTER_MONTHS[currentQuarter.quarter] || [];
  };

  const months = getMonths();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>
            履职台账
            {currentQuarter && (
              <span style={{ fontSize: 16, color: '#999', marginLeft: 12 }}>
                {currentQuarter.year}年 Q{currentQuarter.quarter}
              </span>
            )}
          </h2>
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            <Tag color="gold">管理层</Tag>默认4分 | 
            <Tag color="blue">攻坚队责任党员</Tag>+4分 | 
            <Tag color="green">双优党员</Tag>+4分 | 
            <Tag color="purple">团队长(Q3起)</Tag>+4分
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
      </div>

      <Table
        dataSource={memberDetails}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        bordered
        expandable={{
          expandedRowRender: (member: MemberWithDetails) => {
            return (
              <div style={{ padding: '8px 16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: 8, border: '1px solid #f0f0f0', width: 120 }}>月份</th>
                      <th style={{ padding: 8, border: '1px solid #f0f0f0', width: 200 }}>
                        <Tooltip title="管理层/攻坚队责任党员+4分，其他按季度规则">
                          维度1：攻坚克难
                        </Tooltip>
                      </th>
                      <th style={{ padding: 8, border: '1px solid #f0f0f0', width: 150 }}>维度2：技术分享</th>
                      <th style={{ padding: 8, border: '1px solid #f0f0f0', width: 200 }}>
                        <Tooltip title="管理层/双优党员/团队长(Q3起)+4分，其他按季度规则">
                          维度3：双优评选
                        </Tooltip>
                      </th>
                      <th style={{ padding: 8, border: '1px solid #f0f0f0', width: 150 }}>维度4：企业文化</th>
                      <th style={{ padding: 8, border: '1px solid #f0f0f0', width: 150 }}>维度5：中国故事</th>
                      <th style={{ padding: 8, border: '1px solid #f0f0f0', width: 80 }}>小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {member.details.map((detail: RoleDetail) => (
                      <tr key={detail.id}>
                        <td style={{ padding: 8, border: '1px solid #f0f0f0', textAlign: 'center' }}>
                          {detail.year}年{detail.month}月
                        </td>
                        <td style={{ padding: 8, border: '1px solid #f0f0f0' }}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Space>
                              <span style={{ fontWeight: 'bold', color: '#cf1322' }}>{calculateDim1(member, detail)}分</span>
                              {member.isManager && <Tag color="gold" size="small">管理层</Tag>}
                            </Space>
                            <Space>
                              <Switch
                                checked={detail.isHardBattleLeader}
                                onChange={() => handleToggleHardBattle(member, detail)}
                                size="small"
                              />
                              <span style={{ fontSize: 12 }}>攻坚队责任党员</span>
                            </Space>
                          </Space>
                        </td>
                        <td style={{ padding: 8, border: '1px solid #f0f0f0', textAlign: 'center' }}>
                          <InputNumber
                            value={detail.dim2TechShare}
                            onChange={(v) => handleScoreChange(detail, 'dim2TechShare', v || 0)}
                            min={0}
                            max={4}
                            step={1}
                            size="small"
                            style={{ width: 60 }}
                          />
                        </td>
                        <td style={{ padding: 8, border: '1px solid #f0f0f0' }}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Space>
                              <span style={{ fontWeight: 'bold', color: '#cf1322' }}>{calculateDim3(member, detail)}分</span>
                              {member.isManager && <Tag color="gold" size="small">管理层</Tag>}
                            </Space>
                            <Space>
                              <Switch
                                checked={detail.isShuangYou}
                                onChange={() => handleToggleShuangYou(member, detail)}
                                size="small"
                              />
                              <span style={{ fontSize: 12 }}>双优党员</span>
                            </Space>
                            <Space>
                              <Switch
                                checked={detail.isTeamLeader}
                                onChange={() => handleToggleTeamLeader(member, detail)}
                                size="small"
                              />
                              <span style={{ fontSize: 12 }}>团队长</span>
                            </Space>
                          </Space>
                        </td>
                        <td style={{ padding: 8, border: '1px solid #f0f0f0', textAlign: 'center' }}>
                          <InputNumber
                            value={detail.dim4Culture}
                            onChange={(v) => handleScoreChange(detail, 'dim4Culture', v || 0)}
                            min={0}
                            max={4}
                            step={0.1}
                            size="small"
                            style={{ width: 60 }}
                          />
                        </td>
                        <td style={{ padding: 8, border: '1px solid #f0f0f0', textAlign: 'center' }}>
                          <InputNumber
                            value={detail.dim5ChinaStory}
                            onChange={(v) => handleScoreChange(detail, 'dim5ChinaStory', v || 0)}
                            min={0}
                            max={4}
                            step={1}
                            size="small"
                            style={{ width: 60 }}
                          />
                        </td>
                        <td style={{ padding: 8, border: '1px solid #f0f0f0', textAlign: 'center', fontWeight: 'bold' }}>
                          {(calculateDim1(member, detail) + detail.dim2TechShare + calculateDim3(member, detail) + detail.dim4Culture + detail.dim5ChinaStory).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }}
      >
        <Table.Column 
          title="序号" 
          width={60} 
          render={(_: any, __: any, index: number) => index + 1} 
        />
        <Table.Column 
          title="党员姓名" 
          dataIndex="name" 
          width={120}
          render={(name: string, record: MemberWithDetails) => (
            <Space>
              <strong>{name}</strong>
              {record.isManager && <Tag color="gold">管理层</Tag>}
            </Space>
          )}
        />
        <Table.Column 
          title="季度平均分" 
          width={120}
          render={(_: any, member: MemberWithDetails) => {
            if (member.details.length === 0) return '-';
            const avg = member.details.reduce((sum: number, d: RoleDetail) => {
              return sum + calculateDim1(member, d) + d.dim2TechShare + calculateDim3(member, d) + d.dim4Culture + d.dim5ChinaStory;
            }, 0) / member.details.length;
            return <strong style={{ color: '#cf1322' }}>{avg.toFixed(2)}</strong>;
          }}
        />
        <Table.Column 
          title="标记状态" 
          width={200}
          render={(_: any, member: MemberWithDetails) => {
            const firstDetail = member.details[0];
            if (!firstDetail) return '-';
            return (
              <Space>
                {firstDetail.isHardBattleLeader && <Tag color="blue">攻坚队</Tag>}
                {firstDetail.isShuangYou && <Tag color="green">双优</Tag>}
                {firstDetail.isTeamLeader && <Tag color="purple">团队长</Tag>}
              </Space>
            );
          }}
        />
      </Table>

      {currentQuarter && (
        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: 12 }}>
          <strong>当前季度规则（Q{currentQuarter.quarter}）：</strong>
          <div style={{ marginTop: 4 }}>
            维度1（攻坚克难）：管理层/攻坚队责任党员 = 4分，其他 = {DIM1_QUARTER_SCORES[currentQuarter.quarter]?.other}分
          </div>
          <div>
            维度3（双优评选）：管理层/双优党员 = 4分{currentQuarter.quarter >= 3 ? '/团队长 = 4分' : ''}，其他 = {DIM3_QUARTER_SCORES[currentQuarter.quarter]?.other}分
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleScorePage;
