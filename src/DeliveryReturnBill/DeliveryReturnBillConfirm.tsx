import React, { useState, useMemo, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from 'react-native';
import { useGlobalStr } from '../../GlobalStrContext';
import { ApiContext, confirmReturn } from './api';
import { ReturnContext, TraceabilityRecord } from './types';
import { EVENT_RETURNED } from './events';

/**
 * Page 4 - Confirm the return of a product that has a delivery traceability.
 *
 * The traceability of the API (ValidateProductSN) is shown as a table, one row
 * with the delivery of the SN. The operator confirms the return, it is saved
 * with scanType = "TRACE" and the quantities of the answer (qty, qtyOk) are
 * sent back to the SN page.
 */
export default function DeliveryReturnBillConfirm({ navigation, route }: any) {
  const params: ReturnContext & {
    f_sn?: string;
    f_traces?: TraceabilityRecord[];
  } = useMemo(() => route.params || {}, [route.params]);

  const {
    gs_deliveryReturnAPI,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_classCode,
    gs_IPAddress,
  } = useGlobalStr();

  const apiCtx: ApiContext = useMemo(
    () => ({
      gs_deliveryReturnAPI,
      gs_wareCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version,
      gs_classCode,
      gs_IPAddress,
    }),
    [
      gs_deliveryReturnAPI,
      gs_wareCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version,
      gs_classCode,
      gs_IPAddress,
    ],
  );

  const [loading, setLoading] = useState(false);
  const [labelError, setLabelError] = useState('');
  const [labelStatus, setLabelStatus] = useState('');
  // True while the confirmation is in flight, a ref is always up to date
  const busyRef = useRef(false);

  /** The traceability records of the scanned SN, one row each. */
  const traces: TraceabilityRecord[] = useMemo(() => {
    if (params.f_traces && params.f_traces.length > 0) {
      return params.f_traces;
    }
    return [];
  }, [params.f_traces]);

  /**
   * Confirms the return of the product.
   */
  const handleConfirmClick = async () => {
    // A double tap would confirm the return twice
    if (busyRef.current) return;

    setLoading(true);
    busyRef.current = true;
    setLabelError('');
    setLabelStatus('');

    try {
      const sn = params.f_sn || (traces[0] ? traces[0].sn : '');
      const result = await confirmReturn(apiCtx, {
        context: params,
        sn: sn,
        trace: traces[0] || null,
      });

      // Refresh the processed quantity, the scanned list and the status on the
      // SN page
      DeviceEventEmitter.emit(EVENT_RETURNED, {
        actualQty: result.actualQty,
        planQty: result.planQty,
        productStatus: result.productStatus,
        billFinished: result.billFinished,
        sn: sn,
        model: params.f_model || (traces[0] ? traces[0].model : ''),
        outBillCode: traces[0] ? traces[0].outBillCode : '',
        sapMainBillCode: traces[0]
          ? traces[0].sapMainBillCode
          : params.f_billCode,
      });

      // Back to the SN scan page for the next product
      navigation.goBack();
    } catch (err: any) {
      const message = err.message || 'Network error';
      setLabelError(message);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const handleExitClick = () => {
    navigation.goBack();
  };

  const first = traces.length > 0 ? traces[0] : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleExitClick} activeOpacity={0.7}>
            <Image
              source={require('../../assets/logo/left.png')}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Return Confirm</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Bill information, one line */}
        <View style={styles.billLine}>
          <Text style={styles.billLineText}>
            {`Bill ${params.f_billCode || first?.mainBillCode || '-'}`}
            {` · Line ${params.f_lineId || '-'}`}
            {` · WH ${params.f_wareCode || gs_wareCode || '-'}`}
            {` · Customer ${params.f_customerCode || '-'}`}
          </Text>
        </View>

        {/* Quantity status header label, same as the legacy confirm page */}
        <View style={styles.statusLabelCard}>
          <Text style={styles.statusLabelText}>
            {`${params.f_sn || (first ? first.sn : '')} Total qty:${
              traces.length
            }`}
          </Text>
        </View>

        {/* The delivery traceability of the scanned SN */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
                <Text style={[styles.headerCell, { width: 130 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 130 }]}>
                  Out Bill
                </Text>
                <Text style={[styles.headerCell, { width: 140 }]}>
                  SAP Bill
                </Text>
                <Text style={[styles.headerCell, { width: 140 }]}>
                  SAP UUID
                </Text>
              </View>

              {traces.length === 0 ? (
                <View style={styles.tableRow}>
                  <Text style={[styles.cell, { width: 690 }]}>
                    No traceability detail found
                  </Text>
                </View>
              ) : (
                traces.map((trace, index) => (
                  <View
                    key={trace.sn || String(index)}
                    style={[
                      styles.tableRow,
                      {
                        backgroundColor:
                          index % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                      },
                    ]}
                  >
                    <Text style={[styles.cell, { width: 150 }]}>
                      {trace.sn || '-'}
                    </Text>
                    <Text style={[styles.cell, { width: 130 }]}>
                      {trace.model || '-'}
                    </Text>
                    <Text style={[styles.cell, { width: 130 }]}>
                      {trace.outBillCode || '-'}
                    </Text>
                    <Text style={[styles.cell, { width: 140 }]}>
                      {trace.sapMainBillCode || '-'}
                    </Text>
                    <Text style={[styles.cell, { width: 140 }]}>
                      {trace.sapUuid || '-'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>

        {labelStatus ? (
          <Text style={styles.statusText}>{labelStatus}</Text>
        ) : null}
        {labelError ? <Text style={styles.infoText}>{labelError}</Text> : null}

        {/* Footer actions, always visible */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnConfirm,
              (loading || traces.length === 0) && styles.btnDisabled,
            ]}
            onPress={handleConfirmClick}
            disabled={loading || traces.length === 0}
          >
            <Text style={styles.btnText}>
              {loading ? 'Saving...' : 'Confirm OK'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0052cc" />
        </View>
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#0052cc',
    paddingHorizontal: width * 0.05,
    height: scale(56),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  returnLogo: {
    width: scale(24),
    height: scale(24),
    marginRight: 10,
    tintColor: '#FFFFFF',
  },
  headerTitle: { color: '#FFFFFF', fontSize: scale(14), fontWeight: '900' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  userNameText: { color: '#FFFFFF', fontSize: scale(12), fontWeight: '700' },
  content: { flex: 1, padding: 8 },
  billLine: {
    backgroundColor: '#0052cc',
    borderRadius: 8,
    padding: 9,
    marginBottom: 8,
  },
  billLineText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  statusLabelCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0052cc',
    marginBottom: 8,
    alignItems: 'center',
  },
  statusLabelText: {
    color: 'red',
    fontSize: 13,
    fontWeight: '900',
  },
  tableCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0052cc',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0052cc',
    paddingVertical: 10,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  cell: {
    fontSize: 11,
    color: '#1E293B',
    textAlign: 'center',
    fontWeight: '600',
  },
  statusText: {
    color: '#0052cc',
    fontSize: 13,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '800',
  },
  infoText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 2,
  },
  btnConfirm: { backgroundColor: '#10B981' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
