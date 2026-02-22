import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box } from '@react-three/drei';
import axios from 'axios';
import { useThree } from '@react-three/fiber';
import { gsap } from 'gsap';
import { Package, Truck, LayoutDashboard, LogOut, Plus, ShoppingCart, RotateCcw } from 'lucide-react';

function Rack({ position, name, slots, onSlotClick, onClick }) {
  const shelfHeight = 6; // เพิ่มความสูงรวมของชั้นวาง
  const levels = [0, 2, 4]; // ขยับระยะห่างระหว่างชั้นให้สูงขึ้น
  const columns = [-0.8, 0, 0.8]; // ขยายความกว้างระหว่างช่อง (Slot) ให้กว้างขึ้นมาก

  const getSlotColor = (status) => {
    switch (status) {
      case 'Empty': return '#e2e8f0';
      case 'Critical': return '#ef4444';
      case 'Occupied': return '#3b82f6';
      default: return '#3b82f6';
    }
  };

  return (
    <group position={position} onClick={onClick}>
      {/* --- โครงสร้างเหล็ก (Rack Structure) ใหญ่ขึ้น --- */}
      {/* เสาหลัก 4 มุม (หนาขึ้นเป็น 0.2) */}
      <Box args={[0.2, shelfHeight + 0.5, 0.2]} position={[-1.2, 3, 0.6]}><meshStandardMaterial color="#334155" /></Box>
      <Box args={[0.2, shelfHeight + 0.5, 0.2]} position={[1.2, 3, 0.6]}><meshStandardMaterial color="#334155" /></Box>
      <Box args={[0.2, shelfHeight + 0.5, 0.2]} position={[-1.2, 3, -0.6]}><meshStandardMaterial color="#334155" /></Box>
      <Box args={[0.2, shelfHeight + 0.5, 0.2]} position={[1.2, 3, -0.6]}><meshStandardMaterial color="#334155" /></Box>

      {levels.map((yPos, lIndex) => (
        <group key={`level-${lIndex}`}>
          {/* คานเหล็กหน้า-หลัง (หนาและยาวขึ้น) */}
          <Box args={[2.5, 0.15, 0.1]} position={[0, yPos, 0.5]}><meshStandardMaterial color="#f59e0b" /></Box>
          <Box args={[2.5, 0.15, 0.1]} position={[0, yPos, -0.5]}><meshStandardMaterial color="#f59e0b" /></Box>

          {columns.map((xPos, cIndex) => {
            const slotIndex = lIndex * 3 + cIndex;
            const slotData = slots[slotIndex];

            return (
              <group key={`slot-${slotIndex}`} position={[xPos, yPos, 0]}>
                {/* 1. ตัวพาเลท (ขยายเป็น 0.7 เมตร ดูใหญ่เต็มตา) */}
                <Box args={[0.7, 0.12, 1.1]} position={[0, 0.1, 0]}>
                  <meshStandardMaterial color="#78350f" />
                </Box>

                {/* 2. ตัวสินค้า (กล่องใบใหญ่ วางเต็มพาเลท) */}
                {slotData.status !== 'Empty' && (
                  <Box
                    args={[0.65, 0.9, 0.9]} // เพิ่มความสูงกล่องเป็น 0.9 และกว้าง 0.65
                    position={[0, 0.6, 0]}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlotClick(slotData, slotIndex);
                    }}
                  >
                    <meshStandardMaterial
                      color={getSlotColor(slotData.status)}
                      emissive={slotData.status === 'Critical' ? '#ef4444' : '#000000'}
                      emissiveIntensity={slotData.status === 'Critical' ? 0.4 : 0}
                    />
                  </Box>
                )}

                {/* 3. ปุ่มกดสำหรับช่องว่าง (ขยายตามขนาดพาเลท) */}
                {slotData.status === 'Empty' && (
                  <Box
                    args={[0.7, 0.05, 1.1]}
                    position={[0, 0.15, 0]}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlotClick(slotData, slotIndex);
                    }}
                  >
                    <meshStandardMaterial color="#ffffff" transparent opacity={0.05} />
                  </Box>
                )}
              </group>
            );
          })}
        </group>
      ))}
      {/* ขยับชื่อ Zone ให้สูงขึ้นตาม Rack */}
      <Text position={[0, 7, 0]} fontSize={0.5} color="#1e293b">
        {name}
      </Text>
    </group>
  );
}

function SceneManager({ viewMode }) {
  const { camera } = useThree();

  React.useEffect(() => {
    if (viewMode === 'focus') {
      // เลื่อนกล้องมาด้านหน้าตรง
      gsap.to(camera.position, { x: 0, y: 2, z: 6, duration: 1.5, ease: "power2.inOut" });
    } else {
      // กลับไปมุมมองเฉียง
      gsap.to(camera.position, { x: 8, y: 8, z: 8, duration: 1.5, ease: "power2.inOut" });
    }
  }, [viewMode, camera]);

  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]); // รายการชั่วคราวสำหรับ Inbound
  const [form, setForm] = useState({ name: '', qty: '', weight: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]); // สำหรับเก็บของที่จะเบิก
  const [selectedRack, setSelectedRack] = useState(null);
  const [viewMode, setViewMode] = useState('overview');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [racks, setRacks] = useState([]);

  useEffect(() => {
    // ใส่ URL ที่ได้จาก Render หลังจาก Deploy Web Service เสร็จ
    const API_URL = "https://warehouse-automation.onrender.com";

    axios.get(`${API_URL}/api/racks`)
      .then(res => {
        setRacks(res.data);
      })
      .catch(err => {
        console.error("เชื่อมต่อ Backend ไม่ได้:", err);
      });
  }, []);

  const addItem = () => {
    if (!form.name || !form.qty || !form.weight) {
      return alert("กรุณากรอกข้อมูลให้ครบทุกช่องก่อน Add");
    }
    setItems([...items, { ...form, id: `PROD-${Date.now()}` }]);
    setForm({ name: '', qty: '', weight: '' }); // ล้างฟอร์ม
  };

  const handleSlotClick = (slotData, index, rackId) => {
    if (viewMode === 'focus') {
      // 1. เก็บข้อมูล Slot ที่เลือกเพื่อโชว์ Pop-up กลางจอ
      setSelectedSlot(slotData);

      // 2. อัปเดตข้อมูลฝั่ง Sidebar (ขวา) 
      // โดยยังคงรักษาโครงสร้าง selectedRack เดิมไว้ (เพื่อให้ Rack ไม่หาย)
      setSelectedRack(prev => ({
        ...prev, // เก็บค่า id: 'A1' เดิมไว้
        currentSlot: slotData, // เพิ่มข้อมูล slot เข้าไปข้างใน
        displayTitle: `${rackId} - Slot ${index + 1}`,
        item: slotData.item || 'ว่าง (Empty)',
        qty: slotData.qty || 0,
      }));
    } else {
      // ถ้าอยู่หน้า Overview แล้วกด: ให้ซูมเข้า Rack นั้น
      const rack = racks.find(r => r.id === rackId);
      setSelectedRack(rack);
      setViewMode('focus');
    }
  };


  const handleConfirm = async () => {
    if (items.length === 0) return alert("ไม่มีรายการสินค้าให้ Confirm");

    try {
      const response = await axios.post('https://warehouse-automation.onrender.com/generate-receipt', { items }, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Receipt-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      setItems([]); // ล้างรายการหลังสำเร็จ
      alert("ดาวน์โหลดใบเสร็จและบาร์โค้ดเรียบร้อย!");
    } catch (error) {
      alert("เกิดข้อผิดพลาด: ตรวจสอบว่ารัน Backend (node index.js) อยู่หรือไม่?");
    }
  };

  const handleOutboundConfirm = async () => {
    if (cart.length === 0) return alert("กรุณาเลือกสินค้าลงตะกร้าก่อน");

    const totalWeight = cart.reduce((sum, i) => sum + (i.weight * i.orderQty), 0).toFixed(2);

    try {
      const response = await axios.post('https://warehouse-automation.onrender.com/generate-outbound-receipt',
        { cart, totalWeight },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Outbound-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();

      setCart([]); // ล้างตะกร้าหลังเบิกเสร็จ
      alert("สร้างใบเบิกสินค้าเรียบร้อย! โปรดนำเอกสารไปยื่นที่โกดัง");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการสร้างใบเบิก");
    }
  };

  // --- Login Page ---
  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
          <div className="flex justify-center mb-6"><Package size={48} className="text-blue-400" /></div>
          <h2 className="text-2xl font-bold mb-6 text-center italic underline decoration-blue-500">Warehouse Automation</h2>
          <div className="space-y-4">
            <button onClick={() => setUser({ name: 'Manager View', role: 'manager' })} className="w-full bg-blue-600 p-3 rounded-lg hover:bg-blue-700 transition font-bold">Admin / Manager</button>
            <button onClick={() => setUser({ name: 'Supplier A', role: 'inbound' })} className="w-full bg-emerald-600 p-3 rounded-lg hover:bg-emerald-700 transition font-bold">Inbound (นำของเข้า)</button>
            <button onClick={() => setUser({ name: 'Customer B', role: 'outbound' })} className="w-full bg-orange-600 p-3 rounded-lg hover:bg-orange-700 transition font-bold">Outbound (เบิกของ)</button>
          </div>
        </div>
      </div>
    );
  }
  //ฟังก์ชันเพิ่มของเข้าตะกร้าเบิก//
  const addToCart = (product) => {
    // เช็คว่ามีของในตะกร้าหรือยัง โดยใช้ ID เป็นตัวเทียบ
    const isExisting = cart.find(item => item.id === product.id);

    if (isExisting) {
      // ถ้ามีแล้ว ให้บวกจำนวนเพิ่มเข้าไปแทน (ไม่เพิ่มแถวใหม่)
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, orderQty: item.orderQty + 1 }
          : item
      ));
    } else {
      // ถ้ายังไม่มี ให้เพิ่มเข้าไปใน List ตะกร้า
      setCart([...cart, { ...product, orderQty: 1 }]);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white p-6 flex flex-col">
        <h1 className="text-xl font-bold flex items-center gap-2 mb-10"><Package className="text-blue-400" /> WMS v.1</h1>
        <nav className="flex-1 space-y-2">
          <div className="text-slate-500 text-xs font-bold mb-2">OPERATIONS</div>
          <div className={`p-3 rounded-lg flex items-center gap-3 ${user.role === 'manager' ? 'bg-blue-600' : 'bg-slate-800'}`}>
            <LayoutDashboard size={18} /> {user.role.toUpperCase()}
          </div>
        </nav>
        <button onClick={() => { setUser(null); setItems([]); }} className="flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-lg transition">
          <LogOut size={18} /> Logout
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-10">
        <header className="mb-8 border-b border-slate-200 pb-5">
          <h2 className="text-3xl font-extrabold text-slate-800">ระบบคลังสินค้าอัตโนมัติ</h2>
          <p className="text-slate-500 italic">ล็อกอินในฐานะ: {user.name} ({user.role})</p>
        </header>

        {/* 1. หน้า INBOUND: ฟอร์มกรอกของ */}
        {user.role === 'inbound' && (
          <section className="animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 mb-8">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-emerald-600"><Plus size={20} /> ลงทะเบียนสินค้านำเข้า</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" placeholder="ชื่อสินค้า" value={form.name} className="border p-3 rounded-lg focus:ring-2 ring-emerald-500 outline-none" onChange={e => setForm({ ...form, name: e.target.value })} />
                <input type="number" placeholder="จำนวน (Unit)" value={form.qty} className="border p-3 rounded-lg focus:ring-2 ring-emerald-500 outline-none" onChange={e => setForm({ ...form, qty: e.target.value })} />
                <input type="number" placeholder="น้ำหนักรวม (Kg)" value={form.weight} className="border p-3 rounded-lg focus:ring-2 ring-emerald-500 outline-none" onChange={e => setForm({ ...form, weight: e.target.value })} />
              </div>
              <button onClick={addItem} className="mt-4 bg-emerald-600 text-white px-8 py-3 rounded-lg hover:bg-emerald-700 font-bold transition">Add to List</button>
            </div>

            {/* ตารางเฉพาะหน้า Inbound */}
            {items.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-800 text-white">
                    <tr><th className="p-4">ID</th><th className="p-4">Product Name</th><th className="p-4">Qty</th><th className="p-4">Weight</th></tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50 transition">
                        <td className="p-4 text-slate-400 text-xs font-mono">{item.id}</td>
                        <td className="p-4 font-bold text-slate-700">{item.name}</td>
                        <td className="p-4">{item.qty}</td>
                        <td className="p-4">{item.weight} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-5 bg-slate-50 text-right">
                  <button onClick={handleConfirm} className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:scale-105 transition shadow-blue-200 shadow-lg">Confirm & Generate PDF Receipt</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 2. หน้า MANAGER: ดู 3D Rack */}
        {user.role === 'manager' && (
          <section className="space-y-6 animate-in zoom-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

              {/* 3D View Section - Container หลัก */}
              <div className="lg:col-span-3 h-[600px] bg-slate-950 rounded-3xl shadow-2xl overflow-hidden relative border-4 border-slate-800">

                {/* --- [Overlay UI ชั้นที่ 1]: หัวข้อและปุ่ม Back --- */}
                <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
                  <div className="bg-white/95 backdrop-blur p-4 rounded-xl shadow-xl border border-blue-200">
                    <p className="text-blue-900 font-black flex items-center gap-2 uppercase tracking-tighter">
                      <LayoutDashboard size={18} className="text-blue-500" />
                      {viewMode === 'overview' ? 'Warehouse Overview' : `Focus Mode: ${selectedRack?.id}`}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Status: Monitoring Mode</p>
                  </div>

                  {viewMode === 'focus' && (
                    <button
                      onClick={() => { setViewMode('overview'); setSelectedRack(null); setSelectedSlot(null); }}
                      className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 animate-in slide-in-from-left duration-300 group"
                    >
                      <RotateCcw size={18} className="group-hover:rotate-[-180deg] transition-transform duration-500" />
                      BACK TO OVERVIEW
                    </button>
                  )}
                </div>

                {/* --- [Overlay UI ชั้นที่ 2]: Legend สี (แสดงเฉพาะ Overview) --- */}
                {viewMode === 'overview' && (
                  <div className="absolute bottom-6 left-6 z-10 flex gap-4 text-[10px] bg-black/60 p-3 rounded-xl text-white backdrop-blur-md border border-white/10">
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-gray-500 rounded-full"></span> Empty</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span> Occupied</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span> Critical</div>
                  </div>
                )}

                {/* --- [Overlay UI ชั้นที่ 3]: Slot Info Panel (ย้ายมาวางตรงนี้ตามที่ตกลงกัน) --- */}
                {selectedSlot && viewMode === 'focus' && (
                  <div className="absolute bottom-6 right-6 z-10 w-64 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-2xl border-t-4 border-blue-500 animate-in slide-in-from-right duration-300">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-black text-slate-800 text-sm">SLOT DETAILS</h4>
                      <button onClick={() => setSelectedSlot(null)} className="text-slate-400 hover:text-red-500 transition">✕</button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Product Name</p>
                        <p className="text-sm font-bold text-slate-700">{selectedSlot.item || 'ไม่มีสินค้า'}</p>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-2">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Quantity</p>
                          <p className="text-lg font-black text-blue-600">{selectedSlot.qty} <span className="text-xs font-normal text-slate-400">PCS</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Status</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${selectedSlot.status === 'Empty' ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600'}`}>
                            {selectedSlot.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- [3D Scene]: มีแค่ Canvas เดียว --- */}
                <Canvas camera={{ position: [8, 8, 8] }}>
                  <color attach="background" args={['#f1f5f9']} />
                  <ambientLight intensity={0.7} />
                  <pointLight position={[10, 10, 10]} intensity={1.5} />
                  <spotLight position={[-10, 10, 10]} angle={0.15} />
                  <gridHelper args={[20, 20, 0xcbd5e1, 0xe2e8f0]} position={[0, -0.05, 0]} />

                  <SceneManager viewMode={viewMode} />

                  {/* ZONE A-1 */}
                  {(viewMode === 'overview' || selectedRack?.id === 'A1') && (
                    <Rack
                      position={viewMode === 'focus' ? [0, 0, 0] : [-2, 0, 0]}
                      name="ZONE A-1"
                      slots={racks[0].slots}
                      onSlotClick={(slotData, index) => handleSlotClick(slotData, index, 'A1')}
                    />
                  )}

                  {/* ZONE B-1 */}
                  {(viewMode === 'overview' || selectedRack?.id === 'B1') && (
                    <Rack
                      position={viewMode === 'focus' ? [0, 0, 0] : [2, 0, 0]}
                      name="ZONE B-1"
                      slots={racks[1].slots}
                      onSlotClick={(slotData, index) => handleSlotClick(slotData, index, 'B1')}
                    />
                  )}

                  <OrbitControls
                    makeDefault
                    enablePan={viewMode === 'overview'}
                    enableRotate={viewMode === 'overview'}
                  />
                </Canvas>
              </div>

              {/* Sidebar รายละเอียดสินค้า (ฝั่งขวา) */}
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 flex flex-col">
                {/* ... (โค้ด Sidebar ของคุณเหมือนเดิม) ... */}
                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                  <Package size={20} className="text-blue-500" /> RACK INFO
                </h3>
                {selectedRack ? (
                  <div className="animate-in fade-in zoom-in duration-300 space-y-6">
                    <p className="text-3xl font-black text-blue-600">
                      {selectedRack.displayTitle || selectedRack.id}
                    </p>
                    {/* ข้อมูลอื่นๆ... */}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-100 rounded-3xl text-slate-400">
                    เลือกชั้นวางใน 3D เพื่อตรวจสอบสต็อก
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 3. หน้า OUTBOUND: เบิกสินค้า */}
        {user.role === 'outbound' && (
          <section className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* ฝั่งซ้าย: รายการสินค้าในคลัง */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-2">
                  <input
                    type="text"
                    placeholder="🔍 ค้นหาชื่อสินค้า หรือ ID..."
                    className="flex-1 p-2 outline-none"
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* สมมติข้อมูลสต็อก (ในอนาคตต้องดึงจาก Database) */}
                  {[
                    { id: 'P001', name: 'น้ำดื่ม 600ml', stock: 120, weight: 0.6 },
                    { id: 'P002', name: 'ข้าวสาร 5kg', stock: 45, weight: 5.0 },
                    { id: 'P003', name: 'ปลากระป๋อง', stock: 300, weight: 0.2 },
                    { id: 'P004', name: 'บะหมี่กึ่งสำเร็จรูป', stock: 500, weight: 0.1 },
                  ].filter(p => p.name.includes(searchTerm) || p.id.includes(searchTerm))
                    .map(p => (
                      <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-orange-500 transition shadow-sm group">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-slate-800">{p.name}</h4>
                            <p className="text-xs text-slate-400">ID: {p.id}</p>
                          </div>
                          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded">Stock: {p.stock}</span>
                        </div>
                        <div className="flex justify-between items-center mt-4">
                          <span className="text-sm font-bold text-orange-600">{p.weight} kg/unit</span>
                          <button
                            onClick={() => addToCart(p)}
                            className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600 transition text-sm"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* ฝั่งขวา: ตะกร้าสินค้าที่จะเบิกออก */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-orange-100 h-fit sticky top-10">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                  <ShoppingCart className="text-orange-500" /> ตะกร้าเบิกของ ({cart.length})
                </h3>

                {cart.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-xl">
                    <p className="text-slate-400">ยังไม่มีสินค้าที่เลือก</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2"> {/* เพิ่ม Scroll ตรงนี้ */}
                    {cart.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 relative group">
                        <button
                          onClick={() => setCart(cart.filter(i => i.id !== c.id))}
                          className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                        >
                          ลบ
                        </button>

                        <p className="font-bold text-sm text-slate-700">{c.name}</p>
                        <p className="text-[10px] text-slate-400 mb-2">ID: {c.id}</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max={c.stock}
                              value={c.orderQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setCart(cart.map(i => i.id === c.id ? { ...i, orderQty: val > c.stock ? c.stock : val } : i))
                              }}
                              className="w-16 border rounded p-1 text-center font-bold text-orange-600 bg-white"
                            />
                            <span className="text-[10px] text-slate-400">/ {c.stock}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-500">{(c.weight * c.orderQty).toFixed(2)} kg</span>
                        </div>
                      </div>
                    ))}

                    {/* สรุปรายการด้านล่างตะกร้า */}
                    <div className="pt-4 border-t-2 border-orange-500 border-dotted mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">รวมทั้งหมด:</span>
                        <span className="font-bold">{cart.length} รายการ</span>
                      </div>
                      <div className="flex justify-between text-lg font-black">
                        <span className="text-slate-800">น้ำหนักรวม:</span>
                        <span className="text-orange-600">
                          {cart.reduce((sum, i) => sum + (i.weight * i.orderQty), 0).toFixed(2)} kg
                        </span>
                      </div>

                      <button
                        onClick={handleOutboundConfirm} // เดี๋ยวเราทำฟังก์ชันนี้ต่อ
                        className="w-full bg-orange-500 text-white mt-4 py-4 rounded-xl font-black hover:bg-orange-600 transition shadow-lg shadow-orange-200 uppercase tracking-wider"
                      >
                        Confirm Outbound
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </section>
        )}
      </div>
    </div>
  );
}