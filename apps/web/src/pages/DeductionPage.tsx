import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Table, Button, Modal, Form, Select, Input, InputNumber, Tag, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { deductionApi } from '../api/bonus';
import { memberApi } from '../api/members';
import { DEDUCTION_TYPES } from '../utils/constants';

interface OutletContext {
  currentQuarter: { id: number; year: number; quarter: number } | null;
  isArchived: boolean;
}

function DeductionPage() {
  const { currentQuarter, isArchived } = useOutletContext<OutletContext>();
  const [records, setRecords] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (currentQuarter?.id) {
      loadData();
      loadMembers();
    }
  }, [currentQuarter]);

  const loadData = async () => {
    if (!currentQuarter?.id) return;
    setLoading(true);
    try {
      const res: any = await deductionApi.getDeductionRecords({ quarterId: currentQuarter.id });
      if (res.code === 200) {
        setRecords(res.data);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const res: any = await memberApi.getMembers();
      if (res.code === 200) {
        setMembers(res.data);
      }
    } catch (error) {}
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    form.setFieldsValue({
      partyMemberId: record.partyMemberId,
      type: record.type,
      score: record.score,
      description: record.description,
      remark: record.remark,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res: any = await deductionApi.deleteDeductionRecord(id);
      if (res.code === 200) {
        message.success('删除成功');
        loadData();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    if (!currentQuarter?.id) return;
    try {
      const data = {
        ...values,
        quarterId: currentQuarter.id,
      };

      if (editingRecord) {
        const res: any = await deductionApi.updateDeductionRecord(editingRecord.id, data);
        if (res.code === 200) message.success('更新成功');
      } else {
        const res: any = await deductionApi.createDeductionRecord(data);
        if (res.code === 200) message.success('创建成功');
      }

      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '序号', width: 60, render: (_: any, __: any, index: number) => index + 1 },
    { title: '党员姓名', dataIndex: ['partyMember', 'name'], width: 100 },
    {
      title: '扣分项目',
      dataIndex: 'type',
      width: 300,
      render: (type: number) => {
        const config = DEDUCTION_TYPES.find(d => d.value === type);
        return config ? `${config.label} (-${config.score}分)` : type;
      },
    },
    { title: '分值', dataIndex: 'score', width: 80, align: 'center' as const, render: (v: number) => <Tag color="red">-{v}</Tag> },
    { title: '描述', dataIndex: 'description', width: 200 },
    { title: '备注', dataIndex: 'remark', width: 150 },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} disabled={isArchived}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} disabled={isArchived}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>扣分台账</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={isArchived}>新增扣分</Button>
      </div>

      <Table columns={columns} dataSource={records} rowKey="id" loading={loading} pagination={false} size="small" bordered />

      <Modal title={editingRecord ? '编辑扣分' : '新增扣分'} open={modalVisible} onOk={() => form.submit()} onCancel={() => setModalVisible(false)}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="partyMemberId" label="党员" rules={[{ required: true }]}>
            <Select placeholder="选择党员">
              {members.map(m => (
                <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="扣分项目" rules={[{ required: true }]}>
            <Select placeholder="选择项目">
              {DEDUCTION_TYPES.map(d => (
                <Select.Option key={d.value} value={d.value}>{d.label} (-{d.score}分)</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="score" label="分值" rules={[{ required: true }]}>
            <InputNumber min={0.5} max={15} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default DeductionPage;
