import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface Product {
  id: string;
  name: string;
  category: string;
  emoji: string;
  badge?: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  bgColor?: string;
}

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
}

export default function ProductCard({ product, onPress }: ProductCardProps) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.87}
      style={styles.card}
    >
      {/* Top image area */}
      <View
        style={[
          styles.imageArea,
          { backgroundColor: product.bgColor ?? '#fdf2f8' },
        ]}
      >
        {product.badge ? (
          <View style={styles.badgeWrap}>
            <Text style={styles.badgeText}>{product.badge}</Text>
          </View>
        ) : null}
        <Text style={styles.emoji}>{product.emoji}</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.category}>{product.category}</Text>

        {/* Stars */}
        <View style={styles.ratingRow}>
          <Text style={styles.star}>⭐</Text>
          <Text style={styles.ratingText}>
            {product.rating.toFixed(1)}
          </Text>
          <Text style={styles.reviewCount}>
            ({product.reviewCount})
          </Text>
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.price.toLocaleString('en-IN')}</Text>
          {hasDiscount && (
            <Text style={styles.originalPrice}>
              ₹{product.originalPrice!.toLocaleString('en-IN')}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    flex: 1,
    boxShadow: '0px 2px 6px rgba(236, 72, 153, 0.08)',
  },
  imageArea: {
    aspectRatio: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeWrap: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ec4899',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  emoji: {
    fontSize: 56,
  },
  body: {
    padding: 10,
    gap: 3,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 18,
  },
  category: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  star: {
    fontSize: 11,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  reviewCount: {
    fontSize: 11,
    color: '#9ca3af',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ec4899',
  },
  originalPrice: {
    fontSize: 12,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
});
