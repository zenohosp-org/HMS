import React, { useState, useMemo } from 'react';
import { Modal, Button, SearchBar } from '@/components/ui';
import { Bed } from 'lucide-react';

export const BedSelectionModal = ({ isOpen, onClose, onSelect, availableBeds }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredBeds = useMemo(() => {
        if (!searchTerm) return availableBeds;
        return availableBeds.filter(bed => {
            const ward = bed.wardName || '';
            const room = bed.roomName || '';
            const num = bed.bedNumber || '';
            const search = searchTerm.toLowerCase();
            return ward.toLowerCase().includes(search) || 
                   room.toLowerCase().includes(search) || 
                   num.toLowerCase().includes(search);
        });
    }, [availableBeds, searchTerm]);

    // Group beds by Ward -> Room
    const groupedBeds = useMemo(() => {
        const groups = {};
        filteredBeds.forEach(bed => {
            const ward = bed.wardName || 'Unassigned Ward';
            const room = bed.roomName ? `Room ${bed.roomName}` : '';
            if (!groups[ward]) groups[ward] = {};
            if (!groups[ward][room]) groups[ward][room] = [];
            groups[ward][room].push(bed);
        });
        return groups;
    }, [filteredBeds]);

    const stats = useMemo(() => {
        const total = availableBeds.length;
        const available = availableBeds.filter(b => b.status === 'AVAILABLE').length;
        const occupied = total - available;
        return { total, available, occupied };
    }, [availableBeds]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Assign Location" size="md">
            <div className="p-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <SearchBar
                            placeholder="Search by ward, room, or bed number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px', fontWeight: 500, color: '#4b5563', backgroundColor: '#f9fafb', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <span>Total: <strong>{stats.total}</strong></span>
                        <span style={{ color: '#059669' }}>Available: <strong>{stats.available}</strong></span>
                        <span style={{ color: '#dc2626' }}>Occupied: <strong>{stats.occupied}</strong></span>
                    </div>
                </div>

                <div className="beds-container" style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                    {Object.keys(groupedBeds).length === 0 ? (
                        <div className="text-center p-8 text-gray-500">
                            No available beds match your search.
                        </div>
                    ) : (
                        Object.keys(groupedBeds).map(ward => (
                            <div key={ward} className="ward-group mb-8">
                                <div style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>{ward}</h3>
                                </div>
                                {Object.keys(groupedBeds[ward]).map(room => (
                                    <div key={room || 'no-room'} className="room-group mb-5 ml-2">
                                        {room && <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>{room}</h4>}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                                            {groupedBeds[ward][room].map(bed => (
                                                <button
                                                    key={bed.id}
                                                    disabled={bed.status !== 'AVAILABLE'}
                                                    onClick={() => onSelect(bed)}
                                                    style={{
                                                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                                        padding: '14px', border: '1px solid #e5e7eb', borderRadius: '10px',
                                                        background: bed.status === 'AVAILABLE' ? '#ffffff' : '#f3f4f6', 
                                                        cursor: bed.status === 'AVAILABLE' ? 'pointer' : 'not-allowed', 
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', textAlign: 'left',
                                                        outline: 'none',
                                                        opacity: bed.status === 'AVAILABLE' ? 1 : 0.7
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (bed.status !== 'AVAILABLE') return;
                                                        e.currentTarget.style.borderColor = '#10b981';
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (bed.status !== 'AVAILABLE') return;
                                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                                        e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                    onFocus={(e) => {
                                                        if (bed.status !== 'AVAILABLE') return;
                                                        e.currentTarget.style.borderColor = '#10b981';
                                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)';
                                                    }}
                                                    onBlur={(e) => {
                                                        if (bed.status !== 'AVAILABLE') return;
                                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                                        e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '12px' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '16px', color: '#1f2937', lineHeight: 1.2 }}>{bed.bedNumber}</span>
                                                        <div style={{ padding: '6px', backgroundColor: bed.status === 'AVAILABLE' ? '#ecfdf5' : '#fee2e2', borderRadius: '8px', color: bed.status === 'AVAILABLE' ? '#10b981' : '#ef4444' }}>
                                                            <Bed size={18} />
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: bed.status === 'AVAILABLE' ? '#10b981' : '#ef4444' }}></span>
                                                        <span style={{ fontSize: '13px', color: bed.status === 'AVAILABLE' ? '#059669' : '#b91c1c', fontWeight: 600 }}>
                                                            {bed.status === 'AVAILABLE' ? 'Available' : (bed.patientName ? `Occupied by ${bed.patientName.split(' ')[0]}` : 'Occupied')}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
                
                <div className="flex justify-end pt-3 border-t">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </Modal>
    );
};
