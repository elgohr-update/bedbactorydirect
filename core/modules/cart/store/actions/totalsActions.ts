import * as types from '@vue-storefront/core/modules/cart/store/mutation-types'
import { Logger } from '@vue-storefront/core/lib/logger'
import { CartService } from '@vue-storefront/core/data-resolver'
import {
  prepareShippingInfoForUpdateTotals,
  createOrderData,
  createShippingInfoData
} from '@vue-storefront/core/modules/cart/helpers'

const totalsActions = {
  async getTotals (context, { addressInformation, hasShippingInformation }) {
    if (hasShippingInformation) {
      return CartService.setServerShippingInfo(addressInformation)
    }

    return CartService.getTotals()
  },
  async overrideServerTotals ({ commit, dispatch }, { addressInformation, hasShippingInformation }) {
    const { resultCode, result } = await dispatch('getTotals', { addressInformation, hasShippingInformation })

    if (resultCode === 200) {
      const totals = result.totals || result
      Logger.info('Overriding server totals. ', 'cart', totals)()
      const itemsAfterTotal = prepareShippingInfoForUpdateTotals(totals.items)

      for (let key of Object.keys(itemsAfterTotal)) {
        const item = itemsAfterTotal[key]
        const product = { server_item_id: item.item_id, totals: item, qty: item.qty }
        await dispatch('updateItem', { product })
      }

      commit(types.CART_UPD_TOTALS, { itemsAfterTotal, totals, platformTotalSegments: totals.total_segments })
      commit(types.CART_SET_TOTALS_SYNC)

      return
    }

    Logger.error(result, 'cart')()
  },
  async syncTotals ({ dispatch, getters, rootGetters }, payload: { forceServerSync: boolean, methodsData?: any } = { forceServerSync: false, methodsData: null }) {
    const methodsData = payload ? payload.methodsData : null
    await dispatch('pullMethods', { forceServerSync: payload.forceServerSync })

    if (getters.canSyncTotals && (getters.isTotalsSyncRequired || payload.forceServerSync)) {
      const shippingMethodsData = methodsData || createOrderData({
        shippingDetails: rootGetters['checkout/getShippingDetails'],
        shippingMethods: rootGetters['shipping/getShippingMethods'],
        paymentMethods: rootGetters['payment/paymentMethods']
      })

      if (shippingMethodsData.country) {
        return dispatch('overrideServerTotals', {
          hasShippingInformation: shippingMethodsData.method_code || shippingMethodsData.carrier_code,
          addressInformation: createShippingInfoData(shippingMethodsData)
        })
      }

      Logger.error('Please do set the tax.defaultCountry in order to calculate totals', 'cart')()
    }
  },
  async refreshTotals ({ dispatch }, payload) {
    Logger.warn('The "cart/refreshTotals" action is deprecated and will not be supported with the Vue Storefront 1.11', 'cart')()
    return dispatch('syncTotals', payload)
  }
}

export default totalsActions
