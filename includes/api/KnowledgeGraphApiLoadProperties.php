<?php

/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

class KnowledgeGraphApiLoadProperties extends ApiBase {

	/**
	 * @inheritDoc
	 */
	public function isWriteMode() {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function mustBePosted(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function execute() {
		$result = $this->getResult();
		$params = $this->extractRequestParams();
		$context = $this->getContext();
		$output = $context->getOutput();

		if ( empty( $params['properties'] ) ) {
			$result->addValue( [ $this->getModuleName() ], 'error', 'empty parameter', ApiResult::NO_VALIDATE );
			return;
		}

		\KnowledgeGraph::initSMW();

		$titles_ = explode( '|', $params['properties'] );
		$titles = [];
		foreach ( $titles_ as $titleText ) {
			$title_ = Title::makeTitleSafe( SMW_NS_PROPERTY, $titleText );
			if ( $title_ && $title_->isKnown() ) {
				$subjects = \KnowledgeGraph::getSubjectsByProperty( $title_->getText() );
				foreach ( $subjects as $title__ ) {
					$titles[$title__->getFullText()] = $title__;
				}
			}
		}
		
		$params['only-properties'] = [];
		$params['depth'] = 0;

		foreach ( $titles as $titleText => $title_ ) {
			if ( !isset( self::$data[$titleText] ) ) {
				\KnowledgeGraph::setSemanticData( $title_, $params['only-properties'], 0, $params['depth'] );
			}
		}

		$res = json_encode( \KnowledgeGraph::$data );
		$result->addValue( [ $this->getModuleName() ], 'data', $res, ApiResult::NO_VALIDATE );
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'properties' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false
			],
			'depth' => [
				ApiBase::PARAM_TYPE => 'integer',
				ApiBase::PARAM_REQUIRED => false
			],
			
		];
	}

	/**
	 * @inheritDoc
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * @inheritDoc
	 */
	protected function getExamplesMessages() {
		return [
			'action=knowledgegraph-load-properties'
			=> 'apihelp-knowledgegraph-load-properties-example-1'
		];
	}

}