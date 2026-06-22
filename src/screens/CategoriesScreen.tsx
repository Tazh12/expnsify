import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useTheme } from '../theme';
import { Card, Icon, Tap } from '../components';
import { CategoryEditor } from '../components/CategoryEditor';
import { useCategories, type Category } from '../store/useCategories';
import { useExpenses } from '../store/useExpenses';
import { fmt } from '../services/format';

interface Props {
  onClose: () => void;
}

export function CategoriesScreen({ onClose }: Props) {
  const C = useTheme();
  const { categories, add, update, remove, nextColor } = useCategories();
  const { expenses } = useExpenses();
  const [editorVisible, setEditorVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);

  const now = new Date();
  const monthExpenses = expenses.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const catStats = categories.map(cat => {
    const txns = monthExpenses.filter(t => t.category_id === cat.id);
    return { cat, count: txns.length, total: txns.reduce((s, t) => s + t.amount, 0) };
  });

  const openNew = () => {
    setEditTarget(null);
    setEditorVisible(true);
  };

  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setEditorVisible(true);
  };

  const handleSave = async (name: string, color: string) => {
    if (editTarget) {
      await update(editTarget.id, { name, color });
    } else {
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || `cat${Date.now()}`;
      await add({ id, name, color, source: 'user' });
    }
    setEditorVisible(false);
  };

  const handleArchive = (cat: Category) => {
    Alert.alert(
      cat.archived ? 'Unarchive category' : 'Archive category',
      cat.archived
        ? `"${cat.name}" will appear in pickers again.`
        : `"${cat.name}" will be hidden from pickers but kept on existing expenses.`,
      [
        { text: 'Cancel' },
        {
          text: cat.archived ? 'Unarchive' : 'Archive',
          onPress: () => update(cat.id, { archived: cat.archived ? 0 : 1 }),
        },
      ]
    );
  };

  const handleDelete = (cat: Category) => {
    if (cat.source === 'seed') {
      Alert.alert('Cannot delete', 'Default categories cannot be deleted, but you can archive them.');
      return;
    }
    Alert.alert(
      'Delete category',
      `All expenses in "${cat.name}" will be moved to "Other".`,
      [
        { text: 'Cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(cat.id) },
      ]
    );
  };

  const active = catStats.filter(s => !s.cat.archived);
  const archived = catStats.filter(s => s.cat.archived);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 0.5, borderBottomColor: C.hair,
      }}>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream }}>Categories</Text>
        <Tap onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={16} stroke={C.muted}/>
        </Tap>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Add button */}
        <Tap onPress={openNew} haptic style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          padding: 14, borderRadius: 16,
          backgroundColor: `${C.sage}1a`,
          borderWidth: 0.5, borderColor: C.sage,
          marginBottom: 20,
        }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={16} stroke="#0E0E0C" sw={2.2}/>
          </View>
          <Text style={{ fontSize: 15, color: C.sage, fontWeight: '500' }}>New category</Text>
        </Tap>

        <Card style={{ overflow: 'hidden', marginBottom: 20 }}>
          {active.map(({ cat, count, total }, i) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              count={count}
              total={total}
              isLast={i === active.length - 1}
              onEdit={() => openEdit(cat)}
              onArchive={() => handleArchive(cat)}
              onDelete={() => handleDelete(cat)}
            />
          ))}
        </Card>

        {archived.length > 0 && (
          <>
            <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 10 }}>Archived</Text>
            <Card style={{ overflow: 'hidden' }}>
              {archived.map(({ cat, count, total }, i) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  count={count}
                  total={total}
                  isLast={i === archived.length - 1}
                  onEdit={() => openEdit(cat)}
                  onArchive={() => handleArchive(cat)}
                  onDelete={() => handleDelete(cat)}
                />
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      <CategoryEditor
        visible={editorVisible}
        initial={editTarget ? { name: editTarget.name, color: editTarget.color } : undefined}
        onSave={handleSave}
        onCancel={() => setEditorVisible(false)}
      />
    </View>
  );
}

function CategoryRow({
  cat, count, total, isLast, onEdit, onArchive, onDelete,
}: {
  cat: Category;
  count: number;
  total: number;
  isLast: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const C = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      padding: 14, paddingHorizontal: 18,
      borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: C.hair,
      opacity: cat.archived ? 0.5 : 1,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${cat.color}2e`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
        <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 18, color: cat.color }}>
          {cat.name[0]?.toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: C.cream, fontWeight: '500' }}>{cat.name}</Text>
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          {count} expense{count !== 1 ? 's' : ''} · {fmt(total)} this month
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity onPress={onEdit} style={{ padding: 6 }}>
          <Icon name="edit" size={16} stroke={C.muted}/>
        </TouchableOpacity>
        <TouchableOpacity onPress={onArchive} style={{ padding: 6 }}>
          <Icon name={cat.archived ? 'arr-r' : 'minus'} size={16} stroke={C.muted}/>
        </TouchableOpacity>
        {cat.source !== 'seed' && (
          <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
            <Icon name="trash" size={16} stroke={C.rose}/>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
