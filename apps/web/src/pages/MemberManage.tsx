import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch, Select, Tag, Space, Popconfirm, message, DatePicker
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { memberApi } from '../api/members';
import type { PartyMember, CreateMemberData } from '../api/members';
import { PARTY_POSITIONS } from '../utils/constants';

function MemberManagePage() {
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<PartyMember | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res: any = await memberApi.getMembers();
      if (res.code === 200) {
        setMembers(res.data);
      }
    } catch (error) {
      message.error('加载党员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMember(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (member: PartyMember) => {
    setEditingMember(member);
    form.setFieldsValue({
      name: member.name,
      partyPositions: JSON.parse(member.partyPositions || '[]'),
      isPartyWorker: member.isPartyWorker,
      isManager: member.isManager,
      status: member.status,
      joinDate: member.joinDate ? member.joinDate.split('T')[0] : undefined,
      transferDate: member.transferDate ? member.transferDate.split('T')[0] : undefined,
      remark: member.remark,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res: any = await memberApi.deleteMember(id);
      if (res.code === 200) {
        message.success('删除成功');
        loadMembers();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const data: CreateMemberData = {
        ...values,
        partyPositions: values.partyPositions || [],
      };

      if (editingMember) {
        const res: any = await memberApi.updateMember(editingMember.id, data);
        if (res.code === 200) {
          message.success('更新成功');
        }
      } else {
        const res: any = await memberApi.createMember(data);
        if (res.code === 200) {
          message.success('创建成功');
        }
      }

      setModalVisible(false);
      loadMembers();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '序号', dataIndex: 'displayOrder', width: 80 },
    { title: '姓名', dataIndex: 'name', width: 120 },
    {
      title: '党内职务',
      dataIndex: 'partyPositions',
      render: (positions: string) => {
        const list = JSON.parse(positions || '[]');
        if (list.length === 0) return '-';
        return (
          <Space wrap>
            {list.map((p: string) => (
              <Tag color="red" key={p}>{p}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '党务工作者',
      dataIndex: 'isPartyWorker',
      width: 100,
      render: (v: boolean) => v ? <Tag color="blue">是</Tag> : '-',
    },
    {
      title: '管理层',
      dataIndex: 'isManager',
      width: 80,
      render: (v: boolean) => v ? <Tag color="gold">是</Tag> : '-',
    },
    {
      title: '转入时间',
      dataIndex: 'joinDate',
      width: 120,
      render: (v: string) => v ? v.split('T')[0] : '-',
    },
    {
      title: '转出时间',
      dataIndex: 'transferDate',
      width: 120,
      render: (v: string) => v ? v.split('T')[0] : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const map: Record<string, { color: string; text: string }> = {
          active: { color: 'green', text: '在职' },
          transferred_out: { color: 'orange', text: '转出' },
          transferred_in: { color: 'blue', text: '调入' },
        };
        const config = map[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: PartyMember) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除党员 "${record.name}" 吗？`}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>党员管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增党员
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={members}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
      />

      <Modal
        title={editingMember ? '编辑党员' : '新增党员'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入党员姓名" />
          </Form.Item>

          <Form.Item
            name="partyPositions"
            label="党内职务"
          >
            <Select
              mode="multiple"
              placeholder="选择党内职务"
              options={PARTY_POSITIONS.map(p => ({ label: p, value: p }))}
            />
          </Form.Item>

          <Form.Item
            name="isPartyWorker"
            label="是否党务工作者"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="isManager"
            label="是否管理层（攻坚克难/双优+4分）"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            initialValue="active"
          >
            <Select
              options={[
                { label: '在职', value: 'active' },
                { label: '转出', value: 'transferred_out' },
                { label: '调入', value: 'transferred_in' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="joinDate"
            label="转入党支部时间"
            rules={[{ required: true, message: '请选择转入时间' }]}
          >
            <Input type="date" placeholder="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            name="transferDate"
            label="转出党支部时间"
          >
            <Input type="date" placeholder="YYYY-MM-DD，未转出请留空" />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default MemberManagePage;
