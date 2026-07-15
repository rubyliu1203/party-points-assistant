import { useState, useEffect } from 'react';
import { Layout, Menu, Select, Space, Typography, Button, Modal, Form, InputNumber, message, Popconfirm, Tag } from 'antd';
import {
  TeamOutlined,
  PieChartOutlined,
  TrophyOutlined,
  SettingOutlined,
  PlusOutlined,
  FileTextOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { quarterApi } from '../api/quarters';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

interface Quarter {
  id: number;
  year: number;
  quarter: number;
  isArchived: boolean;
}

const menuItems = [
  { key: '/', icon: <PieChartOutlined />, label: '仪表盘' },
  { key: '/members', icon: <TeamOutlined />, label: '党员管理' },
  {
    key: '/scores',
    icon: <TrophyOutlined />,
    label: '党员积分',
    children: [
      { key: '/scores', label: '积分汇总' },
      { key: '/role-scores', label: '履职台账' },
      { key: '/bonus', label: '加分台账' },
      { key: '/deductions', label: '扣分台账' },
    ],
  },
  { key: '/work-scores', icon: <FileTextOutlined />, label: '党务积分' },
];

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [currentQuarter, setCurrentQuarter] = useState<Quarter | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 子菜单映射：子路径 -> 父菜单key
  const childToParent: Record<string, string> = {
    '/role-scores': '/scores',
    '/bonus': '/scores',
    '/deductions': '/scores',
  };

  const getOpenKeys = () => {
    const parent = childToParent[location.pathname];
    return parent ? [parent] : [];
  };

  useEffect(() => {
    loadQuarters();
  }, []);

  const loadQuarters = async () => {
    try {
      const res: any = await quarterApi.getQuarters();
      if (res.code === 200) {
        setQuarters(res.data);
        const currentRes: any = await quarterApi.getCurrentQuarter();
        if (currentRes.code === 200 && currentRes.data) {
          setCurrentQuarter(currentRes.data);
        } else if (res.data.length > 0) {
          setCurrentQuarter(res.data[0]);
        }
      }
    } catch (error) {
      console.error('加载季度失败:', error);
    }
  };

  const handleQuarterChange = (quarterId: number) => {
    const quarter = quarters.find(q => q.id === quarterId);
    if (quarter) {
      setCurrentQuarter(quarter);
      quarterApi.setCurrentQuarter(quarterId);
    }
  };

  const handleCreateQuarter = async (values: any) => {
    try {
      const { year, quarter } = values;
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;
      
      const res: any = await quarterApi.createQuarter({
        year,
        quarter,
        startDate: `${year}-${String(startMonth).padStart(2, '0')}-01`,
        endDate: `${year}-${String(endMonth).padStart(2, '0')}-${quarter === 1 || quarter === 4 ? '31' : '30'}`,
      });

      if (res.code === 200) {
        message.success('季度创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadQuarters();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const handleArchiveQuarter = async () => {
    if (!currentQuarter) return;
    try {
      const res: any = await quarterApi.archiveQuarter(currentQuarter.id);
      if (res.code === 200) {
        message.success(res.message);
        loadQuarters();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '归档失败');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.06)' }}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <Title level={4} style={{ margin: 0, color: '#cf1322' }}>
            党员党务积分助手
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <Space>
            <span style={{ color: '#666' }}>当前季度：</span>
            <Select
              value={currentQuarter?.id}
              onChange={handleQuarterChange}
              style={{ width: 180 }}
              placeholder="选择季度"
            >
              {quarters.map(q => (
                <Select.Option key={q.id} value={q.id}>
                  {q.year}年 Q{q.quarter} {q.isArchived ? '【已归档】' : ''}
                </Select.Option>
              ))}
            </Select>
            {currentQuarter?.isArchived && (
              <Tag color="red" icon={<LockOutlined />}>已归档（只读）</Tag>
            )}
            {!currentQuarter?.isArchived && (
              <Popconfirm
                title="确认归档？"
                description="归档后该季度数据将冻结，只允许查看，不允许编辑。"
                onConfirm={handleArchiveQuarter}
                okText="归档"
                cancelText="取消"
              >
                <Button type="primary" danger size="small">
                  归档季度
                </Button>
              </Popconfirm>
            )}
            <Button 
              type="link" 
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              新建季度
            </Button>
          </Space>
          <Space>
            <span style={{ color: '#999', fontSize: 14 }}>
              产品研发部党支部
            </span>
            <SettingOutlined style={{ color: '#999', cursor: 'pointer' }} />
          </Space>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet context={{ currentQuarter, isArchived: currentQuarter?.isArchived ?? false }} />
        </Content>
      </Layout>
      <Modal
        title="新建季度"
        open={createModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setCreateModalVisible(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateQuarter}>
          <Form.Item
            name="year"
            label="年份"
            rules={[{ required: true, message: '请输入年份' }]}
            initialValue={2026}
          >
            <InputNumber style={{ width: '100%' }} min={2020} max={2030} />
          </Form.Item>
          <Form.Item
            name="quarter"
            label="季度"
            rules={[{ required: true, message: '请选择季度' }]}
          >
            <Select placeholder="选择季度">
              <Select.Option value={1}>第一季度 (1-3月)</Select.Option>
              <Select.Option value={2}>第二季度 (4-6月)</Select.Option>
              <Select.Option value={3}>第三季度 (7-9月)</Select.Option>
              <Select.Option value={4}>第四季度 (10-12月)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default AppLayout;
